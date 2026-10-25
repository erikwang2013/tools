function buildRtpPacket(
  { payloadType = 96, sequence = 1, timestamp = 0, ssrc = 0, marker = false } = {},
  payload = Buffer.alloc(0)
) {
  const header = Buffer.alloc(12)
  header[0] = 0x80
  header[1] = (marker ? 0x80 : 0) | (payloadType & 0x7f)
  header.writeUInt16BE(sequence & 0xffff, 2)
  header.writeUInt32BE(timestamp >>> 0, 4)
  header.writeUInt32BE(ssrc >>> 0, 8)
  return Buffer.concat([header, payload])
}

function parseRtpPacket(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) throw new Error("RTP packet too short")
  const version = buffer[0] >> 6
  if (version !== 2) throw new Error(`unsupported RTP version ${version}`)
  const padding = (buffer[0] & 0x20) !== 0
  const extension = (buffer[0] & 0x10) !== 0
  const csrcCount = buffer[0] & 0x0f
  let offset = 12 + csrcCount * 4
  if (extension) {
    if (buffer.length < offset + 4) throw new Error("truncated RTP extension")
    const words = buffer.readUInt16BE(offset + 2)
    offset += 4 + words * 4
  }
  if (buffer.length < offset) throw new Error("truncated RTP header")
  const end = padding ? buffer.length - buffer[buffer.length - 1] : buffer.length
  if (end < offset) throw new Error("invalid RTP padding")
  return {
    version,
    marker: (buffer[1] & 0x80) !== 0,
    payloadType: buffer[1] & 0x7f,
    sequence: buffer.readUInt16BE(2),
    timestamp: buffer.readUInt32BE(4),
    ssrc: buffer.readUInt32BE(8),
    payload: buffer.subarray(offset, end),
  }
}

function buildRtcpRr(ssrc = 0) {
  const packet = Buffer.alloc(8)
  packet[0] = 0x80
  packet[1] = 201
  packet.writeUInt16BE(1, 2)
  packet.writeUInt32BE(ssrc >>> 0, 4)
  return packet
}

function buildRtcpSdes(ssrc = 0, cname = "postwoman") {
  const text = Buffer.from(String(cname), "utf8")
  const chunk = Buffer.concat([Buffer.from([1, text.length & 0xff]), text, Buffer.from([0])])
  let body = Buffer.concat([Buffer.alloc(4), chunk])
  while ((4 + body.length) % 4 !== 0) body = Buffer.concat([body, Buffer.from([0])])
  const packet = Buffer.alloc(4 + body.length)
  packet[0] = 0x81
  packet[1] = 202
  packet.writeUInt16BE(packet.length / 4 - 1, 2)
  packet.writeUInt32BE(ssrc >>> 0, 4)
  chunk.copy(packet, 8)
  return packet
}

function parseRtcpPackets(buffer) {
  const packets = []
  let offset = 0
  while (offset + 4 <= buffer.length) {
    const count = buffer[offset] & 0x1f
    const type = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    const size = (length + 1) * 4
    if (size < 4 || offset + size > buffer.length) break
    const packet = { type, length, count, raw: buffer.subarray(offset + 4, offset + size) }
    if (type === 200 && size >= 20) {
      packet.ssrc = buffer.readUInt32BE(offset + 4)
      packet.ntp = `${buffer.readUInt32BE(offset + 8)}.${buffer.readUInt32BE(offset + 12)}`
      packet.rtpTimestamp = buffer.readUInt32BE(offset + 16)
      packet.packetCount = buffer.readUInt32BE(offset + 20)
      packet.octetCount = buffer.readUInt32BE(offset + 24)
    } else if (type === 201 && size >= 8) {
      packet.ssrc = buffer.readUInt32BE(offset + 4)
    } else if (type === 202 && size >= 8) {
      packet.ssrc = buffer.readUInt32BE(offset + 4)
      packet.cname = readCname(buffer.subarray(offset + 8, offset + size))
    }
    packets.push(packet)
    offset += size
  }
  return packets
}

function readCname(chunk) {
  let index = 0
  while (index + 2 <= chunk.length) {
    const type = chunk[index]
    if (type === 0) break
    const length = chunk[index + 1]
    if (type === 1) return chunk.subarray(index + 2, index + 2 + length).toString("utf8")
    index += 2 + length
  }
  return undefined
}

module.exports = {
  buildRtpPacket,
  parseRtpPacket,
  buildRtcpRr,
  buildRtcpSdes,
  parseRtcpPackets,
}
