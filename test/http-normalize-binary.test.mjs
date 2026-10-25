import test from "node:test"
import assert from "node:assert/strict"
import { describeBinaryResponse, normalizeResponse } from "../functions/http-normalize.mjs"

test("keeps arraybuffer bodies intact", () => {
  const buf = new Uint8Array([0, 1, 255]).buffer
  assert.equal(normalizeResponse({ status: 200, headers: {}, data: buf }).data, buf)
})

test("explains binary responses that came back as text via a proxy", () => {
  assert.equal(
    describeBinaryResponse(new Uint8Array([1]).buffer, { responseType: "arraybuffer" }).ok,
    true
  )
  const bad = describeBinaryResponse("abc", { responseType: "arraybuffer", viaProxy: true })
  assert.equal(bad.ok, false)
  assert.match(bad.message, /proxy|extension/i)
})
