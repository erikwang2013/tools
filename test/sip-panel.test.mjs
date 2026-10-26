import test from "node:test"
import assert from "node:assert/strict"
import { buildSipTarget, resolveSipServer } from "../functions/sip-panel.mjs"

test("builds a sip uri and resolves the server", () => {
  assert.equal(buildSipTarget({ user: "1001", domain: "sip.test" }), "sip:1001@sip.test")
  assert.equal(
    resolveSipServer({ mode: "direct", wsUrl: "wss://s/ws", bridgeUrl: "" }),
    "wss://s/ws"
  )
  assert.throws(
    () => resolveSipServer({ mode: "agent", wsUrl: "wss://s/ws", bridgeUrl: "" }),
    /bridge/i
  )
})
