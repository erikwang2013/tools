// Common ISO 8583:1987 fields; enough for a debug lab, not a full scheme.
const FIELD_SPECS = {
  2: { type: "llvar", length: 2, encoding: "ascii", max: 19 },
  3: { type: "fixed", length: 6, encoding: "ascii" },
  4: { type: "fixed", length: 12, encoding: "ascii" },
  7: { type: "fixed", length: 10, encoding: "ascii" },
  11: { type: "fixed", length: 6, encoding: "ascii" },
  12: { type: "fixed", length: 6, encoding: "ascii" },
  13: { type: "fixed", length: 4, encoding: "ascii" },
  32: { type: "llvar", length: 2, encoding: "ascii", max: 11 },
  37: { type: "fixed", length: 12, encoding: "ascii" },
  39: { type: "fixed", length: 2, encoding: "ascii" },
  41: { type: "fixed", length: 8, encoding: "ascii" },
  42: { type: "fixed", length: 15, encoding: "ascii" },
  49: { type: "fixed", length: 3, encoding: "ascii" },
  55: { type: "lllvar", length: 3, encoding: "ascii", max: 999 },
}

function encodeBcd(value) {
  const digits = String(value)
  if (!/^\d*$/.test(digits)) throw new Error("BCD field must contain digits only")
  const padded = digits.length % 2 ? `0${digits}` : digits
  return Buffer.from(padded, "hex")
}

function decodeBcd(buffer) {
  return buffer.toString("hex")
}

function encodeField(spec, value) {
  if (spec.encoding === "bcd") return encodeBcd(value)
  return Buffer.from(String(value), "utf8")
}

function readLengthPrefix(buffer, offset, digits, encoding) {
  if (encoding === "bcd") {
    const bytes = Math.ceil(digits / 2)
    if (buffer.length < offset + bytes) return null
    return { value: Number(decodeBcd(buffer.subarray(offset, offset + bytes))), size: bytes }
  }
  if (buffer.length < offset + digits) return null
  const raw = buffer.subarray(offset, offset + digits).toString("utf8")
  if (!/^\d+$/.test(raw)) throw new Error("invalid ISO 8583 length prefix")
  return { value: Number(raw), size: digits }
}

function setBitmap(bitmap, field) {
  const index = (field - 1) >> 3
  bitmap[index] |= 1 << (7 - ((field - 1) & 7))
}

function encodeIso8583({ mti, fields = {} } = {}, { lengthHeader = "none", lengthEncoding = "ascii" } = {}) {
  if (!/^\d{4}$/.test(String(mti || ""))) throw new Error("mti must be 4 digits")
  const numbers = Object.keys(fields).map(Number).sort((a, b) => a - b)
  for (const field of numbers) {
    if (!FIELD_SPECS[field]) throw new Error(`Unknown ISO 8583 field ${field}`)
  }
  const secondary = numbers.some(field => field > 64)
  const bitmap = Buffer.alloc(secondary ? 16 : 8)
  if (secondary) setBitmap(bitmap, 1)
  for (const field of numbers) setBitmap(bitmap, field)
  const parts = [Buffer.from(String(mti), "utf8"), bitmap]
  for (const field of numbers) {
    const spec = FIELD_SPECS[field]
    const value = fields[field]
    const encoded = encodeField(spec, value)
    if (spec.type === "fixed") {
      if (encoded.length !== spec.length && spec.encoding !== "bcd") {
        throw new Error(`Field ${field} must be ${spec.length} characters`)
      }
      parts.push(encoded)
      continue
    }
    const digits = String(value)
    if (digits.length > spec.max) throw new Error(`Field ${field} exceeds ${spec.max} characters`)
    parts.push(Buffer.from(String(digits.length).padStart(spec.length, "0"), "utf8"))
    parts.push(encoded)
  }
  const message = Buffer.concat(parts)
  return Buffer.concat([lengthHeaderFor(message.length, lengthHeader, lengthEncoding), message])
}

function lengthHeaderFor(length, lengthHeader, lengthEncoding) {
  if (lengthHeader === "none") return Buffer.alloc(0)
  if (lengthHeader === "2") {
    if (lengthEncoding === "binary") {
      if (length > 255) throw new Error("message too large for a 1-byte length header")
      return Buffer.from([length])
    }
    if (length > 99) throw new Error("message too large for a 2-digit length header")
    return Buffer.from(String(length).padStart(2, "0"), "utf8")
  }
  if (lengthHeader === "4") {
    if (lengthEncoding === "binary") {
      const header = Buffer.alloc(2)
      header.writeUInt16BE(length)
      return header
    }
    if (length > 9999) throw new Error("message too large for a 4-digit length header")
    return Buffer.from(String(length).padStart(4, "0"), "utf8")
  }
  throw new Error(`unsupported lengthHeader: ${lengthHeader}`)
}

function stripLengthHeader(buffer, lengthHeader, lengthEncoding) {
  if (lengthHeader === "none") return { length: buffer.length, size: 0 }
  if (lengthHeader === "2") {
    if (lengthEncoding === "binary") {
      if (buffer.length < 1) return { incomplete: true }
      return { length: buffer[0], size: 1 }
    }
    if (buffer.length < 2) return { incomplete: true }
    return { length: Number(buffer.subarray(0, 2).toString()), size: 2 }
  }
  if (lengthHeader === "4") {
    if (lengthEncoding === "binary") {
      if (buffer.length < 2) return { incomplete: true }
      return { length: buffer.readUInt16BE(0), size: 2 }
    }
    if (buffer.length < 4) return { incomplete: true }
    return { length: Number(buffer.subarray(0, 4).toString()), size: 4 }
  }
  throw new Error(`unsupported lengthHeader: ${lengthHeader}`)
}

function decodeIso8583(input, { lengthHeader = "none", lengthEncoding = "ascii" } = {}) {
  const header = stripLengthHeader(input, lengthHeader, lengthEncoding)
  if (header.incomplete) throw new Error("Incomplete ISO 8583 message")
  const buffer = input.subarray(header.size)
  if (buffer.length !== header.length) {
    if (buffer.length < header.length) throw new Error("Incomplete ISO 8583 message")
    throw new Error("ISO 8583 length header does not match the payload")
  }
  if (buffer.length < 12) throw new Error("Incomplete ISO 8583 message")
  const mti = buffer.subarray(0, 4).toString("utf8")
  if (!/^\d{4}$/.test(mti)) throw new Error("invalid ISO 8583 MTI")
  const primary = buffer.subarray(4, 12)
  const hasSecondary = (primary[0] & 1) !== 0
  const bitmap = hasSecondary ? buffer.subarray(4, 20) : primary
  let offset = 4 + bitmap.length
  const fields = {}
  const maxField = bitmap.length * 8
  for (let field = 2; field <= maxField; field += 1) {
    const index = (field - 1) >> 3
    const bit = 1 << (7 - ((field - 1) & 7))
    if ((bitmap[index] & bit) === 0) continue
    const spec = FIELD_SPECS[field]
    if (!spec) throw new Error(`Unknown ISO 8583 field ${field}`)
    if (spec.type === "fixed") {
      const size = spec.encoding === "bcd" ? Math.ceil(spec.length / 2) : spec.length
      if (offset + size > buffer.length) throw new Error("Incomplete ISO 8583 message")
      const raw = buffer.subarray(offset, offset + size)
      offset += size
      fields[field] = spec.encoding === "bcd" ? decodeBcd(raw) : raw.toString("utf8")
      continue
    }
    const prefix = readLengthPrefix(buffer, offset, spec.length, spec.encoding)
    if (!prefix) throw new Error("Incomplete ISO 8583 message")
    offset += prefix.size
    const size = spec.encoding === "bcd" ? Math.ceil(prefix.value / 2) : prefix.value
    if (offset + size > buffer.length) throw new Error("Incomplete ISO 8583 message")
    const raw = buffer.subarray(offset, offset + size)
    offset += size
    fields[field] = spec.encoding === "bcd" ? decodeBcd(raw) : raw.toString("utf8")
  }
  if (offset !== buffer.length) throw new Error("ISO 8583 message has trailing bytes")
  return { mti, fields }
}

module.exports = {
  FIELD_SPECS,
  encodeIso8583,
  decodeIso8583,
  stripLengthHeader,
}
