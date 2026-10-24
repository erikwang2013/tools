import test from "node:test"
import assert from "node:assert/strict"
import WebSocket from "ws"
import { createRequire } from "node:module"
import { AgentClient } from "../../functions/agent-client.mjs"
const require = createRequire(import.meta.url)
const { createAgentServer } = require("../lib/server")

const echo = {
  id: "echo",
  async create(config, emit) {
    return {
      ready: { greeted: true },
      send(payload) {
        emit({
          type: "data",
          payload: { encoding: "utf8", data: payload.data, bytes: payload.data.length },
        })
      },
      close() {
        emit({ type: "closed", payload: { reason: "test" } })
      },
    }
  },
}

test("connects, opens, sends and receives", async () => {
  const srv = await createAgentServer({
    port: 0,
    token: "t",
    origins: [],
    allowNoOrigin: true,
    adapters: { echo },
  })
  const client = new AgentClient({ WebSocketImpl: WebSocket })
  const seen = []
  client.addEventListener("session", e => seen.push(e.detail))
  await client.connect(`ws://127.0.0.1:${srv.port}/agent`, "t")
  const { sessionId, payload } = await client.open("echo", {})
  assert.deepEqual(payload, { greeted: true })
  await client.send(sessionId, { encoding: "utf8", data: "hi" })
  await new Promise(r => setTimeout(r, 50))
  assert.equal(
    seen.some(e => e.type === "data" && e.payload.data === "hi"),
    true
  )
  await client.close(sessionId)
  client.disconnect()
  await srv.close()
})

test("rejects a wrong token", async () => {
  const srv = await createAgentServer({
    port: 0,
    token: "t",
    origins: [],
    allowNoOrigin: true,
    adapters: {},
  })
  const client = new AgentClient({ WebSocketImpl: WebSocket })
  await assert.rejects(
    () => client.connect(`ws://127.0.0.1:${srv.port}/agent`, "bad"),
    /invalid token/i
  )
  await srv.close()
})
