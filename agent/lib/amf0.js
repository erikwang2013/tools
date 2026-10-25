function encodeString(value) {
  const bytes = Buffer.from(String(value), "utf8")
  if (bytes.length <= 0xffff) {
    const header = Buffer.alloc(3)
    header[0] = 0x02
    header.writeUInt16BE(bytes.length, 1)
    return Buffer.concat([header, bytes])
  }
  const header = Buffer.alloc(5)
  header[0] = 0x0c
  header.writeUInt32BE(bytes.length, 1)
  return Buffer.concat([header, bytes])
}

function encodeAmf0(value) {
  if (typeof value === "number") {
    const out = Buffer.alloc(9)
    out[0] = 0x00
    out.writeDoubleBE(value, 1)
    return out
  }
  if (typeof value === "boolean") return Buffer.from([0x01, value ? 1 : 0])
  if (typeof value === "string") return encodeString(value)
  if (value === null) return Buffer.from([0x05])
  if (Array.isArray(value)) {
    const header = Buffer.alloc(5)
    header[0] = 0x0a
    header.writeUInt32BE(value.length, 1)
    return Buffer.concat([header, ...value.map(encodeAmf0)])
  }
  if (typeof value === "object") {
    const parts = [Buffer.from([0x03])]
    for (const [key, item] of Object.entries(value)) {
      const keyBytes = Buffer.from(key, "utf8")
      const keyHeader = Buffer.alloc(2)
      keyHeader.writeUInt16BE(keyBytes.length, 0)
      parts.push(keyHeader, keyBytes, encodeAmf0(item))
    }
    parts.push(Buffer.from([0x00, 0x00, 0x09]))
    return Buffer.concat(parts)
  }
  throw new Error(`Unsupported AMF0 type: ${typeof value}`)
}

function decodeAmf0(buffer, offset = 0) {
  if (offset >= buffer.length) throw new Error("Truncated AMF0 value")
  const marker = buffer[offset]
  switch (marker) {
    case 0x00:
      if (buffer.length < offset + 9) throw new Error("Truncated AMF0 number")
      return { value: buffer.readDoubleBE(offset + 1), consumed: 9 }
    case 0x01:
      if (buffer.length < offset + 2) throw new Error("Truncated AMF0 boolean")
      return { value: buffer[offset + 1] !== 0, consumed: 2 }
    case 0x02: {
      if (buffer.length < offset + 3) throw new Error("Truncated AMF0 string")
      const length = buffer.readUInt16BE(offset + 1)
      if (buffer.length < offset + 3 + length) throw new Error("Truncated AMF0 string")
      return { value: buffer.subarray(offset + 3, offset + 3 + length).toString("utf8"), consumed: 3 + length }
    }
    case 0x0c: {
      if (buffer.length < offset + 5) throw new Error("Truncated AMF0 long string")
      const length = buffer.readUInt32BE(offset + 1)
      if (buffer.length < offset + 5 + length) throw new Error("Truncated AMF0 long string")
      return { value: buffer.subarray(offset + 5, offset + 5 + length).toString("utf8"), consumed: 5 + length }
    }
    case 0x05:
      return { value: null, consumed: 1 }
    case 0x0a: {
      if (buffer.length < offset + 5) throw new Error("Truncated AMF0 array")
      const count = buffer.readUInt32BE(offset + 1)
      let cursor = offset + 5
      const value = []
      for (let i = 0; i < count; i += 1) {
        const item = decodeAmf0(buffer, cursor)
        value.push(item.value)
        cursor += item.consumed
      }
      return { value, consumed: cursor - offset }
    }
    case 0x03: {
      let cursor = offset + 1
      const value = {}
      for (;;) {
        if (buffer.length < cursor + 2) throw new Error("Truncated AMF0 object")
        const keyLength = buffer.readUInt16BE(cursor)
        cursor += 2
        if (keyLength === 0) {
          if (buffer[cursor] !== 0x09) throw new Error("Truncated AMF0 object end")
          cursor += 1
          break
        }
        if (buffer.length < cursor + keyLength) throw new Error("Truncated AMF0 object key")
        const key = buffer.subarray(cursor, cursor + keyLength).toString("utf8")
        cursor += keyLength
        const item = decodeAmf0(buffer, cursor)
        value[key] = item.value
        cursor += item.consumed
      }
      return { value, consumed: cursor - offset }
    }
    default:
      throw new Error(`Unsupported AMF0 marker 0x${marker.toString(16)}`)
  }
}

module.exports = { encodeAmf0, decodeAmf0 }
