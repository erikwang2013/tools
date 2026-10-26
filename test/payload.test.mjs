import test from "node:test"
import assert from "node:assert/strict"
import { editorToWire, wireToEditor, MAX_PAYLOAD_BYTES } from "../functions/payload.mjs"

test("maps editor modes to wire encodings", () => {
  assert.deepEqual(editorToWire({ mode: "text", text: "hi" }), { encoding: "utf8", data: "hi" })
  assert.deepEqual(editorToWire({ mode: "json", text: "{}" }), { encoding: "utf8", data: "{}" })
  assert.deepEqual(editorToWire({ mode: "hex", text: "4869" }), {
    encoding: "base64",
    data: "SGk=",
  })
  assert.deepEqual(editorToWire({ mode: "base64", base64: "SGk=" }), {
    encoding: "base64",
    data: "SGk=",
  })
  assert.equal(editorToWire({ mode: "none" }), null)
})

test("rejects invalid and oversized payloads", () => {
  assert.throws(() => editorToWire({ mode: "hex", text: "zz" }), /invalid hex/i)
  assert.throws(() => editorToWire({ mode: "base64", base64: "!!!" }), /invalid base64/i)
  const big = "a".repeat(MAX_PAYLOAD_BYTES + 1)
  assert.throws(() => editorToWire({ mode: "text", text: big }), /too large/i)
})
