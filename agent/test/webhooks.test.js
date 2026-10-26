const test = require("node:test")
const assert = require("node:assert/strict")
const WebSocket = require("ws")
const { createAgentServer } = require("../lib/server")
const adapters = require("../adapters")

function openSession(port, protocol, config) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/agent`)
    const events = []
    ws.on("open", () => ws.send(JSON.stringify({ v: 1, type: "auth", token: "t" })))
    ws.on("error", reject)
    ws.on("message", raw => {
      const message = JSON.parse(raw)
      if (message.type === "auth:ok") {
        ws.send(JSON.stringify({ v: 1, type: "open", id: "h1", protocol, config }))
      } else if (message.type === "ready") {
        resolve({ ws, events, ready: message.payload })
      } else {
        events.push(message)
      }
    })
  })
}

test("receives a hook request and replies with the configured response", async () => {
  const srv = await createAgentServer({
    port: 0,
    token: "t",
    origins: [],
    allowNoOrigin: true,
    adapters,
  })
  const { ws, events, ready } = await openSession(srv.port, "webhooks", {
    responseCode: 201,
    responseBody: "ok",
  })
  const response = await fetch(ready.url, { method: "POST", body: "hi" })
  assert.equal(response.status, 201)
  assert.equal(await response.text(), "ok")
  await new Promise(resolve => setTimeout(resolve, 50))
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  assert.equal(data.payload.method, "POST")
  assert.equal(Buffer.from(data.payload.data, "base64").toString(), "hi")
  ws.close()
  await srv.close()
})
