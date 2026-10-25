const test = require("node:test")
const assert = require("node:assert/strict")
const {
  buildRtcpRr,
  buildRtcpSdes,
  buildRtpPacket,
  parseRtcpPackets,
  parseRtpPacket,
} = require("../lib/rtp")

test("round-trips an RTP packet", () => {
  const packet = buildRtpPacket(
    { payloadType: 97, sequence: 7, timestamp: 1600, ssrc: 42, marker: true },
    Buffer.from("hi")
  )
  const parsed = parseRtpPacket(packet)
  assert.equal(parsed.payloadType, 97)
  assert.equal(parsed.sequence, 7)
  assert.equal(parsed.timestamp, 1600)
  assert.equal(parsed.ssrc, 42)
  assert.equal(parsed.marker, true)
  assert.deepEqual(parsed.payload, Buffer.from("hi"))
})

test("rejects a malformed RTP packet", () => {
  assert.throws(() => parseRtpPacket(Buffer.alloc(11)), /too short/)
})

test("parses RTCP RR and SDES", () => {
  const packets = parseRtcpPackets(Buffer.concat([buildRtcpRr(9), buildRtcpSdes(9, "postwoman")]))
  assert.equal(packets[0].type, 201)
  assert.equal(packets[0].ssrc, 9)
  assert.equal(packets[1].type, 202)
  assert.equal(packets[1].cname, "postwoman")
})
