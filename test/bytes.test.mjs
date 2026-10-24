import test from "node:test"
import assert from "node:assert/strict"
import { toHexDump, hexToBytes, bytesToBase64, isHex } from "../functions/bytes.mjs"

test("hexdump has offsets and grouped bytes", () => {
  const dump = toHexDump(new Uint8Array([0x00, 0x41, 0xff]), { width: 4 })
  assert.match(dump, /^00000000\s+00 41 ff/)
})

test("hex validation and conversion", () => {
  assert.equal(isHex("4869"), true)
  assert.equal(isHex("4g"), false)
  assert.deepEqual([...hexToBytes("4869")], [0x48, 0x69])
  assert.equal(bytesToBase64(new Uint8Array([0x48, 0x69])), "SGk=")
})
