import test from "node:test"
import assert from "node:assert/strict"
import { buildMessageStanza, resolveService } from "../functions/xmpp-panel.mjs"

test("builds a message stanza", () => {
  assert.deepEqual(buildMessageStanza({ to: "a@b", body: "hi" }), {
    name: "message",
    attrs: { to: "a@b" },
    children: [{ name: "body", text: "hi" }],
  })
})

test("agent mode requires a bridge url", () => {
  assert.equal(
    resolveService({ mode: "direct", serviceUrl: "wss://x/ws", bridgeUrl: "" }),
    "wss://x/ws"
  )
  assert.throws(
    () => resolveService({ mode: "agent", serviceUrl: "wss://x/ws", bridgeUrl: "" }),
    /bridge/i
  )
})
