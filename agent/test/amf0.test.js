const test = require("node:test")
const assert = require("node:assert/strict")
const { decodeAmf0, encodeAmf0 } = require("../lib/amf0")

test("round-trips AMF0 values", () => {
  const values = [
    42,
    1.5,
    true,
    "hello",
    null,
    ["a", 2],
    { app: "live", nested: { ok: true } },
  ]
  for (const value of values) {
    const encoded = encodeAmf0(value)
    const decoded = decodeAmf0(encoded)
    assert.deepEqual(decoded.value, value)
    assert.equal(decoded.consumed, encoded.length)
  }
})

test("rejects unsupported AMF0 types", () => {
  assert.throws(() => encodeAmf0(() => {}), /Unsupported AMF0/)
})
