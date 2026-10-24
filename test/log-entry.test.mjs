import test from "node:test"
import assert from "node:assert/strict"
import { makeLogEntry } from "../functions/log-entry.mjs"

test("keeps small entries with their byte count and source", () => {
  const entry = makeLogEntry({
    direction: "received",
    encoding: "base64",
    data: "aGk=",
    bytes: 2,
    remote: "127.0.0.1:1234",
  })
  assert.equal(entry.direction, "received")
  assert.equal(entry.encoding, "base64")
  assert.equal(entry.data, "aGk=")
  assert.equal(entry.bytes, 2)
  assert.equal(entry.remote, "127.0.0.1:1234")
  assert.equal(entry.truncated, undefined)
  assert.equal(typeof entry.ts, "number")
})

test("truncates a large preview and keeps the original byte count", () => {
  const entry = makeLogEntry({
    direction: "received",
    encoding: "base64",
    data: "A".repeat(6000),
    bytes: 4500,
  })
  assert.equal(entry.data.length, 5464)
  assert.equal(entry.truncated, true)
  assert.equal(entry.bytes, 4500)
  assert.equal(entry.remote, undefined)
})

test("omits remote when it is missing", () => {
  const entry = makeLogEntry({ direction: "info", encoding: "utf8", data: "hello" })
  assert.equal("remote" in entry, false)
})
