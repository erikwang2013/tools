const BVLC_TYPE = 0x81
const BVLC_ORIGINAL_UNICAST = 0x0a
const BVLC_ORIGINAL_BROADCAST = 0x0b

function buildBvlc(functionCode, npdu) {
  const header = Buffer.alloc(4)
  header[0] = BVLC_TYPE
  header[1] = functionCode
  header.writeUInt16BE(4 + npdu.length, 2)
  return Buffer.concat([header, npdu])
}

function buildNpdu(apdu, { expectingReply = true } = {}) {
  return Buffer.concat([Buffer.from([0x01, expectingReply ? 0x04 : 0x00]), apdu])
}

function objectId(type, instance) {
  return ((Number(type) & 0x3ff) << 22) | (Number(instance) & 0x3fffff)
}

function encodeObjectId(value) {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32BE(value >>> 0)
  return buffer
}

function buildWhoIs() {
  return buildBvlc(
    BVLC_ORIGINAL_BROADCAST,
    buildNpdu(Buffer.from([0x10, 0x08]), { expectingReply: false })
  )
}

function buildReadProperty({ type, instance, property = 85, invokeId = 1 }) {
  const apdu = Buffer.alloc(10)
  apdu[0] = 0x00
  apdu[1] = 0x05
  apdu[2] = invokeId
  apdu[3] = 0x0c
  encodeObjectId(objectId(type, instance)).copy(apdu, 4)
  apdu[8] = property & 0xff
  return buildBvlc(BVLC_ORIGINAL_UNICAST, buildNpdu(apdu.subarray(0, 9)))
}

function buildWriteProperty({ type, instance, property = 85, value, invokeId = 1 }) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error("value must be numeric")
  const apdu = Buffer.alloc(16)
  apdu[0] = 0x00
  apdu[1] = 0x05
  apdu[2] = invokeId
  apdu[3] = 0x0f
  encodeObjectId(objectId(type, instance)).copy(apdu, 4)
  apdu[8] = property & 0xff
  apdu[9] = 0x3e
  apdu[10] = 0x44
  apdu.writeFloatBE(number, 11)
  apdu[15] = 0x3f
  return buildBvlc(BVLC_ORIGINAL_UNICAST, buildNpdu(apdu))
}

function parseBvlc(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 6) return null
  if (buffer[0] !== BVLC_TYPE) throw new Error("invalid BACnet BVLC type")
  const length = buffer.readUInt16BE(2)
  if (buffer.length < length) return null
  return { functionCode: buffer[1], npdu: buffer.subarray(4, length), consumed: length }
}

function parseApdu(npdu) {
  if (npdu.length < 2) return null
  const apdu = npdu.subarray(2)
  const pduType = apdu[0] >> 4
  if (pduType === 1) {
    const service = apdu[1]
    if (service === 0) {
      return {
        type: "i-am",
        objectId: apdu.readUInt32BE(2),
        maxApdu: apdu.readUIntBE(6, 3) & 0xffff,
        vendorId: apdu.readUInt16BE(10),
      }
    }
    return { type: "unconfirmed", service }
  }
  if (pduType === 3) {
    const invokeId = apdu[1]
    const service = apdu[2]
    const object = apdu.readUInt32BE(3)
    const property = apdu[7]
    const values = []
    let offset = 8
    while (offset < apdu.length && apdu[offset] !== 0x3f) {
      const tag = apdu[offset]
      if (tag === 0x3e) {
        offset += 1
        continue
      }
      const fixed = tag & 0x07
      if (tag === 0x44) {
        values.push(apdu.readFloatBE(offset + 1))
        offset += 5
      } else if (tag === 0x21 || tag === 0x11) {
        values.push(apdu[offset + 1])
        offset += 2
      } else if (tag === 0x75) {
        const length = apdu[offset + 1]
        values.push(apdu.subarray(offset + 3, offset + 3 + length).toString("utf8"))
        offset += 3 + length
      } else {
        offset += 1 + fixed
      }
    }
    return { type: "complex-ack", invokeId, service, objectId: object, property, values }
  }
  if (pduType === 5) return { type: "error", invokeId: apdu[1], error: apdu[2] }
  if (pduType === 6) return { type: "reject", invokeId: apdu[1], reason: apdu[2] }
  if (pduType === 7) return { type: "abort", invokeId: apdu[1], reason: apdu[2] }
  return { type: "simple-ack", invokeId: apdu[1], service: apdu[2] }
}

module.exports = {
  buildWhoIs,
  buildReadProperty,
  buildWriteProperty,
  parseBvlc,
  parseApdu,
  objectId,
}
