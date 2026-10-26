const test = require("node:test")
const assert = require("node:assert/strict")
const { isAllowedOrigin, DEFAULT_ORIGINS } = require("../lib/origin")

test("allows the documented origins only", () => {
  assert.equal(isAllowedOrigin("https://tools.erik.xyz", DEFAULT_ORIGINS), true)
  assert.equal(isAllowedOrigin("http://localhost:3000", DEFAULT_ORIGINS), true)
  assert.equal(isAllowedOrigin("https://evil.example", DEFAULT_ORIGINS), false)
  assert.equal(isAllowedOrigin(undefined, DEFAULT_ORIGINS), false)
})
