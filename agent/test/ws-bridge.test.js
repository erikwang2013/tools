const test = require("node:test")
const assert = require("node:assert/strict")
const { WebSocketServer, WebSocket } = require("ws")
const { createAgentServer } = require("../lib/server")
const adapters = require("../adapters")

function authAndOpen(port, protocol, config) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/agent`)
    ws.on("open", () => ws.send(JSON.stringify({ v: 1, type: "auth", token: "t" })))
    ws.on("error", reject)
    ws.on("message", raw => {
      const message = JSON.parse(raw)
      if (message.type === "auth:ok") {
        ws.send(JSON.stringify({ v: 1, type: "open", id: "b1", protocol, config }))
      } else if (message.type === "ready") {
        resolve({ ws, ready: message.payload })
      } else if (message.type === "error") {
        reject(new Error(message.payload.message))
      }
    })
  })
}

test("bridges text and binary frames and cleans up", async () => {
  const upstream = new WebSocketServer({ port: 0 })
  upstream.on("connection", ws => ws.on("message", (data, isBinary) => ws.send(data, { binary: isBinary })))
  await new Promise(resolve => upstream.once("listening", resolve))
  const targetUrl = `ws://127.0.0.1:${upstream.address().port}`
  const srv = await createAgentServer({
    port: 0,
    token: "t",
    origins: [],
    allowNoOrigin: true,
    adapters,
  })
  const { ws, ready } = await authAndOpen(srv.port, "ws-bridge", { targetUrl })
  const bridge = new WebSocket(ready.url)
  await new Promise((resolve, reject) => {
    bridge.on("open", resolve)
    bridge.on("error", reject)
  })

  const text = new Promise(resolve =>
    bridge.once("message", (data, isBinary) => resolve({ data: data.toString(), isBinary }))
  )
  bridge.send("hi")
  assert.deepEqual(await text, { data: "hi", isBinary: false })

  const binary = new Promise(resolve =>
    bridge.once("message", (data, isBinary) => resolve({ data: [...data], isBinary }))
  )
  bridge.send(Buffer.from([0, 1, 255]), { binary: true })
  assert.deepEqual(await binary, { data: [0, 1, 255], isBinary: true })

  bridge.close()
  ws.close()
  await srv.close()
  await new Promise(resolve => upstream.close(resolve))
})
