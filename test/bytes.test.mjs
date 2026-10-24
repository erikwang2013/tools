import test from "node:test"
import assert from "node:assert/strict"
import { toHexDump, hexToBytes, bytesToHex, bytesToBase64, isHex } from "../functions/bytes.mjs"

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

test("hexdump clamps non-positive width", () => {
  const dump = toHexDump(new Uint8Array([0x00, 0x41]), { width: 0 })
  assert.match(dump, /^00000000\s+00\n00000001\s+41/)
})

test("large buffers round-trip hex", () => {
  const bytes = Uint8Array.from({ length: 1024 * 1024 }, (_, i) => (i * 31 + 7) & 0xff)
  const hex = bytesToHex(bytes)
  assert.match(hex, /^[0-9a-f]+$/)
  assert.equal(hex.length, bytes.length * 2)
  assert.deepEqual(hexToBytes(hex), bytes)
})
