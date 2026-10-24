const test = require("node:test")
const assert = require("node:assert/strict")
const { toBuffer, fromBuffer } = require("../lib/payload")

test("converts utf8 and base64 payloads", () => {
  assert.equal(toBuffer({ encoding: "utf8", data: "hi" }).toString(), "hi")
  assert.equal(toBuffer({ encoding: "base64", data: "aGk=" }).toString(), "hi")
})

test("rejects invalid encoding and base64", () => {
  assert.throws(() => toBuffer({ encoding: "hex", data: "00" }))
  assert.throws(() => toBuffer({ encoding: "base64", data: "!!!" }))
})

test("fromBuffer returns base64 with byte length", () => {
  assert.deepEqual(fromBuffer(Buffer.from("hi")), { encoding: "base64", data: "aGk=", bytes: 2 })
})
