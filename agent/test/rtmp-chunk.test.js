const test = require("node:test")
const assert = require("node:assert/strict")
const { encodeChunk, RtmpChunkDecoder } = require("../lib/rtmp-chunk")

test("round-trips a small message", () => {
  const payload = Buffer.from("hello")
  const decoder = new RtmpChunkDecoder()
  const messages = decoder.push(encodeChunk({ typeId: 20, payload }))
  assert.equal(messages.length, 1)
  assert.equal(messages[0].typeId, 20)
  assert.deepEqual(messages[0].payload, payload)
})

test("reassembles a message larger than the chunk size", () => {
  const payload = Buffer.alloc(400, 0xab)
  const decoder = new RtmpChunkDecoder({ chunkSize: 128 })
  const messages = decoder.push(encodeChunk({ typeId: 9, payload, chunkSize: 128 }))
  assert.equal(messages.length, 1)
  assert.deepEqual(messages[0].payload, payload)
})

test("buffers partial chunks", () => {
  const frame = encodeChunk({ typeId: 20, payload: Buffer.from("hello") })
  const decoder = new RtmpChunkDecoder()
  assert.deepEqual(decoder.push(frame.subarray(0, 3)), [])
  const messages = decoder.push(frame.subarray(3))
  assert.equal(messages[0].payload.toString(), "hello")
})
