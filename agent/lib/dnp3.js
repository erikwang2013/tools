const crc = require("dnp3-crc")

const START = Buffer.from([0x05, 0x64])
const MAX_USER_BYTES = 250

function crcBuffer(block) {
  const value = crc.calculate(block)
  return Buffer.from([value & 0xff, (value >> 8) & 0xff])
}

function buildLinkFrame({
  source = 1,
  destination = 10,
  direction = "master",
  userData = Buffer.alloc(0),
  functionCode = 4,
} = {}) {
  if (userData.length > MAX_USER_BYTES) throw new Error("DNP3 user data too large")
  const length = 5 + userData.length
  const control = direction === "master" ? 0xc0 | functionCode : 0x40 | functionCode
  const header = Buffer.alloc(8)
  START.copy(header, 0)
  header[2] = length
  header[3] = control
  header.writeUInt16LE(destination, 4)
  header.writeUInt16LE(source, 6)
  const parts = [header, crcBuffer(header)]
  for (let offset = 0; offset < userData.length; offset += 16) {
    const block = userData.subarray(offset, offset + 16)
    parts.push(block, crcBuffer(block))
  }
  return Buffer.concat(parts)
}

function parseLinkFrame(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) return null
  if (buffer[0] !== 0x05 || buffer[1] !== 0x64) throw new Error("invalid DNP3 start bytes")
  const length = buffer[2]
  const userBytes = length - 5
  if (userBytes < 0) throw new Error("invalid DNP3 length")
  const blockCount = Math.ceil(userBytes / 16)
  const total = 10 + userBytes + blockCount * 2
  if (buffer.length < total) return null
  const header = buffer.subarray(0, 8)
  const headerCrc = buffer.readUInt16LE(8)
  if (crc.calculate(header) !== headerCrc) throw new Error("DNP3 header CRC mismatch")
  const chunks = []
  let offset = 10
  let remaining = userBytes
  for (let i = 0; i < blockCount; i += 1) {
    const size = Math.min(16, remaining)
    const block = buffer.subarray(offset, offset + size)
    const expected = buffer.readUInt16LE(offset + size)
    if (crc.calculate(block) !== expected) throw new Error("DNP3 data CRC mismatch")
    chunks.push(block)
    remaining -= size
    offset += size + 2
  }
  return {
    control: header[3],
    destination: header.readUInt16LE(4),
    source: header.readUInt16LE(6),
    userData: Buffer.concat(chunks),
    consumed: total,
  }
}

function buildReadRequest({ group = 60, variation = 1, qualifier = 0x06 } = {}) {
  return Buffer.from([0xc0, 0x01, group, variation, qualifier])
}

function buildDirectOperate({ index = 0, value = 1 } = {}) {
  // CROB (group 12, variation 1), one-byte count with 2-byte index prefix.
  const body = Buffer.alloc(19)
  body[0] = 0xc0
  body[1] = 5
  body[2] = 12
  body[3] = 1
  body[4] = 0x17
  body[5] = 1
  body.writeUInt16LE(index, 6)
  body[8] = value ? 0x41 : 0x01
  body[9] = 1
  body.writeUInt16LE(0, 10)
  body.writeUInt16LE(0, 12)
  body[14] = 0
  return body.subarray(0, 15)
}

function parseApplication(userData) {
  if (userData.length < 2) return null
  const control = userData[0]
  const functionCode = userData[1]
  const objects = []
  let offset = 2
  while (offset + 3 <= userData.length) {
    const group = userData[offset]
    const variation = userData[offset + 1]
    const qualifier = userData[offset + 2]
    objects.push({ group, variation, qualifier })
    // Object values depend on the group; the lab logs the header and raw bytes.
    break
  }
  return { control, functionCode, objects, raw: userData }
}

module.exports = {
  buildLinkFrame,
  parseLinkFrame,
  buildReadRequest,
  buildDirectOperate,
  parseApplication,
  crcBuffer,
}
