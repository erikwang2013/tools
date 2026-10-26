const test = require("node:test")
const assert = require("node:assert/strict")
const { encode, decode, ProtocolError } = require("../lib/envelope")

test("round-trips an open message", () => {
  const msg = { v: 1, type: "open", id: "s1", protocol: "tcp", config: { host: "127.0.0.1" } }
  assert.deepEqual(decode(encode(msg)), msg)
})

test("rejects unknown version and type", () => {
  assert.throws(() => decode('{"v":2,"type":"open","id":"s1"}'), ProtocolError)
  assert.throws(() => decode('{"v":1,"type":"nope","id":"s1"}'), ProtocolError)
})

test("rejects oversized messages", () => {
  const raw = JSON.stringify({ v: 1, type: "auth", token: "x".repeat(100) })
  assert.throws(() => decode(raw, { maxBytes: 32 }), ProtocolError)
})

test("rejects missing id for session messages", () => {
  assert.throws(() => decode('{"v":1,"type":"send","id":""}'), ProtocolError)
})
