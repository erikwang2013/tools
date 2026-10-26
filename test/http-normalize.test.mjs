import test from "node:test"
import assert from "node:assert/strict"
import { normalizeResponse } from "../functions/http-normalize.mjs"

test("normalizes axios and extension response shapes", () => {
  assert.deepEqual(normalizeResponse({ status: 200, headers: { a: "b" }, data: "ok" }), {
    status: 200,
    headers: { a: "b" },
    data: "ok",
  })
  assert.deepEqual(normalizeResponse("raw"), { status: 200, headers: {}, data: "raw" })
})
