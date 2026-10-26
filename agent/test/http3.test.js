const test = require("node:test")
const assert = require("node:assert/strict")
const http3 = require("../adapters/http3")

test("fails clearly when the runtime lacks HTTP/3", async () => {
  await assert.rejects(http3.create({}, () => {}), error => {
    assert.equal(error.code, "UNSUPPORTED")
    assert.match(error.message, /HTTP\/3 is not available/i)
    return true
  })
})
