const START = 0x68

function control(type, sendSeq = 0, recvSeq = 0) {
  if (type === "I") {
    return Buffer.from([
      (sendSeq << 1) & 0xfe,
      (sendSeq >> 7) & 0xff,
      (recvSeq << 1) & 0xfe,
      (recvSeq >> 7) & 0xff,
    ])
  }
  if (type === "S") return Buffer.from([0x01, 0x00, (recvSeq << 1) & 0xfe, (recvSeq >> 7) & 0xff])
  throw new Error("use encodeUFrame for U-frames")
}

function encodeApdu({ type, sendSeq = 0, recvSeq = 0, asdu = Buffer.alloc(0) } = {}) {
  if (type === "U") throw new Error("U-frames are encoded with encodeUFrame")
  const ctrl = control(type, sendSeq, recvSeq)
  const length = ctrl.length + asdu.length
  if (length > 253) throw new Error("IEC 104 APDU too large")
  return Buffer.concat([Buffer.from([START, length]), ctrl, asdu])
}

function encodeUFrame(code) {
  const ctrl = Buffer.from([code, 0, 0, 0])
  return Buffer.concat([Buffer.from([START, ctrl.length]), ctrl])
}

const U = {
  STARTDT_ACT: 0x07,
  STARTDT_CON: 0x0b,
  STOPDT_ACT: 0x13,
  STOPDT_CON: 0x23,
  TESTFR_ACT: 0x43,
  TESTFR_CON: 0x83,
}

function encodeAsdu({ typeId, cause, commonAddress, ioa = 0, value, count = 1, sequence = false }) {
  const vsq = (sequence ? 0x80 : 0) | (count & 0x7f)
  const header = Buffer.alloc(6)
  header[0] = typeId
  header[1] = vsq
  header[2] = cause & 0x3f
  header[3] = 0
  header.writeUInt16LE(commonAddress, 4)
  const parts = [header]
  const ioaBuffer = Buffer.alloc(3)
  ioaBuffer.writeUIntLE(ioa, 0, 3)
  if (value === undefined) {
    parts.push(ioaBuffer)
    return Buffer.concat(parts)
  }
  if (sequence) {
    parts.push(ioaBuffer)
    if (Array.isArray(value)) {
      for (const item of value) {
        const body = Buffer.alloc(2)
        body.writeInt16LE(item)
        parts.push(body)
      }
    }
    return Buffer.concat(parts)
  }
  const body = Buffer.alloc(2)
  body.writeInt16LE(value)
  parts.push(ioaBuffer, body)
  return Buffer.concat(parts)
}

function encodeInterrogation({ commonAddress = 1 } = {}) {
  const asdu = Buffer.alloc(7)
  asdu[0] = 100
  asdu[1] = 1
  asdu[2] = 6
  asdu.writeUInt16LE(commonAddress, 4)
  asdu[6] = 20
  return encodeApdu({ type: "I", asdu })
}

function encodeRead({ commonAddress = 1, ioa = 0 } = {}) {
  const asdu = Buffer.alloc(9)
  asdu[0] = 102
  asdu[1] = 1
  asdu[2] = 5
  asdu.writeUInt16LE(commonAddress, 4)
  asdu.writeUIntLE(ioa, 6, 3)
  return encodeApdu({ type: "I", asdu })
}

function parseAsdu(asdu) {
  if (asdu.length < 6) return null
  const typeId = asdu[0]
  const vsq = asdu[1]
  const cause = asdu[2] & 0x3f
  const commonAddress = asdu.readUInt16LE(4)
  const sequence = (vsq & 0x80) !== 0
  const count = vsq & 0x7f
  const values = []
  if (typeId === 100 || typeId === 102) {
    return { typeId, cause, commonAddress, values, count }
  }
  if (typeId === 1) {
    let offset = 6
    let ioa = sequence ? asdu.readUIntLE(offset, 3) : 0
    if (sequence) offset += 3
    for (let i = 0; i < count; i += 1) {
      if (!sequence) {
        if (offset + 3 > asdu.length) break
        ioa = asdu.readUIntLE(offset, 3)
        offset += 3
      }
      if (offset >= asdu.length) break
      const siq = asdu[offset++]
      values.push({ ioa: ioa + (sequence ? i : 0), value: (siq & 1) !== 0, quality: siq >> 1 })
    }
  } else if (typeId === 9 || typeId === 11) {
    let offset = 6
    let ioa = sequence ? asdu.readUIntLE(offset, 3) : 0
    if (sequence) offset += 3
    for (let i = 0; i < count; i += 1) {
      if (!sequence) {
        if (offset + 3 > asdu.length) break
        ioa = asdu.readUIntLE(offset, 3)
        offset += 3
      }
      if (offset + 2 > asdu.length) break
      const value = asdu.readInt16LE(offset)
      offset += 2
      const quality = offset < asdu.length ? asdu[offset++] : 0
      values.push({ ioa: ioa + (sequence ? i : 0), value, quality })
    }
  }
  return { typeId, cause, commonAddress, sequence, count, values }
}

class FeedParser {
  constructor() {
    this.buffer = Buffer.alloc(0)
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    const frames = []
    while (this.buffer.length >= 2) {
      if (this.buffer[0] !== START) {
        this.buffer = this.buffer.subarray(1)
        continue
      }
      const length = this.buffer[1]
      if (this.buffer.length < 2 + length) break
      const raw = this.buffer.subarray(0, 2 + length)
      this.buffer = this.buffer.subarray(2 + length)
      const ctrl = raw.subarray(2, 6)
      if ((ctrl[0] & 1) === 0) {
        frames.push({
          type: "I",
          sendSeq: (ctrl[0] >> 1) | (ctrl[1] << 7),
          recvSeq: (ctrl[2] >> 1) | (ctrl[3] << 7),
          asdu: raw.subarray(6),
        })
      } else if ((ctrl[0] & 3) === 1) {
        frames.push({
          type: "S",
          recvSeq: (ctrl[2] >> 1) | (ctrl[3] << 7),
        })
      } else {
        frames.push({ type: "U", code: ctrl[0] })
      }
    }
    return frames
  }
}

module.exports = {
  U,
  FeedParser,
  encodeApdu,
  encodeUFrame,
  encodeAsdu,
  encodeInterrogation,
  encodeRead,
  parseAsdu,
}
