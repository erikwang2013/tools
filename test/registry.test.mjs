import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { GROUPS, protocols, getProtocol } from "../protocols/registry.mjs"
const require = createRequire(import.meta.url)
const adapters = require("../agent/adapters/index.js")

const FIELD_TYPES = new Set([
  "text",
  "number",
  "password",
  "select",
  "checkbox",
  "textarea",
  "keyvalue",
  "timer",
])
const PANELS = new Set([null, "hls", "webrtc", "stomp", "xmpp", "sip", "mcp", "a2a", "webhooks"])

const fieldDefault = (id, key) => getProtocol(id).fields.find(f => f.key === key)?.default

test("groups are exact and ordered", () => {
  assert.deepEqual(GROUPS, [
    "HTTP",
    "Browser Realtime",
    "Raw & Streaming",
    "RPC & Messaging",
    "IoT / Industrial",
    "Agent",
  ])
})

test("registry is internally consistent", () => {
  const ids = new Set()
  for (const p of protocols) {
    assert.equal(ids.has(p.id), false, `duplicate id ${p.id}`)
    ids.add(p.id)
    assert.equal(GROUPS.includes(p.group), true, `bad group ${p.group}`)
    assert.ok(["agent", "http", "browser"].includes(p.transport), `bad transport ${p.id}`)
    assert.ok(PANELS.has(p.panel), `bad panel ${p.id}`)
    for (const f of p.fields) {
      assert.ok(f.key && f.label, `field missing key/label in ${p.id}`)
      assert.equal(FIELD_TYPES.has(f.type), true, `bad field type ${f.type} in ${p.id}`)
      if (f.type === "select") assert.ok(Array.isArray(f.options) && f.options.length > 0)
    }
    if (p.transport === "agent") {
      assert.equal(typeof adapters[p.id]?.create, "function", `missing adapter for ${p.id}`)
    }
    if (p.transport === "http") {
      assert.equal(typeof p.buildRequest, "function", `missing builder for ${p.id}`)
    }
  }
})

test("phase-0 entries are pinned", () => {
  for (const id of ["tcp", "udp"]) {
    const p = getProtocol(id)
    assert.ok(p, `missing protocol ${id}`)
    assert.equal(p.payload, "binary")
    assert.deepEqual(p.actions, ["connect", "send", "close"])
    assert.equal(p.agentFallback, false)
    assert.equal(p.buildRequest, null)
    assert.equal(typeof p.label, "string")
    assert.ok(p.label.length > 0, `empty label for ${id}`)
  }
})

test("tcp and udp key defaults", () => {
  assert.equal(fieldDefault("tcp", "host"), "127.0.0.1")
  assert.equal(fieldDefault("tcp", "port"), 9000)
  assert.equal(fieldDefault("tcp", "encoding"), "base64")
  assert.equal(fieldDefault("udp", "bindPort"), 0)
})

test("lookup returns a descriptor", () => {
  assert.equal(getProtocol("tcp").id, "tcp")
  assert.equal(getProtocol("missing"), undefined)
})
