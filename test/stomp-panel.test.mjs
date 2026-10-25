import test from "node:test"
import assert from "node:assert/strict"
import { formatFrameLog, resolveBrokerUrl } from "../functions/stomp-panel.mjs"

test("direct mode keeps the broker url", () => {
  assert.equal(
    resolveBrokerUrl({ mode: "direct", brokerUrl: "wss://b.test/ws", bridgeUrl: "" }),
    "wss://b.test/ws"
  )
})

test("agent mode requires a bridge url", () => {
  assert.equal(
    resolveBrokerUrl({ mode: "agent", brokerUrl: "wss://b.test/ws", bridgeUrl: "ws://127.0.0.1:1/bridge/x" }),
    "ws://127.0.0.1:1/bridge/x"
  )
  assert.throws(
    () => resolveBrokerUrl({ mode: "agent", brokerUrl: "wss://b.test/ws", bridgeUrl: "" }),
    /bridge/i
  )
})

test("frame log includes command and headers", () => {
  assert.match(
    formatFrameLog({ command: "MESSAGE", headers: { destination: "/q" }, body: "hi" }),
    /MESSAGE[\s\S]*destination: \/q[\s\S]*hi/
  )
})
