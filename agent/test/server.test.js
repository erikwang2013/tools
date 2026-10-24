const test = require("node:test")
const assert = require("node:assert/strict")
const { once } = require("node:events")
const WebSocket = require("ws")
const { createAgentServer } = require("../lib/server")

async function start() {
  return createAgentServer({
    port: 0, token: "test-token", origins: [], allowNoOrigin: true, adapters: {},
  })
}

test("serves health without auth", async () => {
  const srv = await start()
  const res = await fetch(`http://127.0.0.1:${srv.port}/health`)
  assert.deepEqual(await res.json(), { ok: true })
  await srv.close()
})

test("rejects a wrong token and accepts the right one", async () => {
  const srv = await start()
  const bad = new WebSocket(`ws://127.0.0.1:${srv.port}/agent`)
  const badReply = await new Promise((resolve, reject) => {
    bad.on("open", () => bad.send(JSON.stringify({ v: 1, type: "auth", token: "nope" })))
    bad.on("message", raw => resolve(JSON.parse(raw)))
    bad.on("error", reject)
  })
  assert.equal(badReply.type, "auth:fail")

  const good = new WebSocket(`ws://127.0.0.1:${srv.port}/agent`)
  const ok = await new Promise((resolve, reject) => {
    good.on("open", () => good.send(JSON.stringify({ v: 1, type: "auth", token: "test-token" })))
    good.on("message", raw => resolve(JSON.parse(raw)))
    good.on("error", reject)
  })
  assert.equal(ok.type, "auth:ok")
  good.close()
  await srv.close()
})

test("rejects a disallowed origin at the upgrade", async () => {
  const srv = await createAgentServer({ port: 0, token: "t", origins: ["http://allowed.example"] })
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/agent`, { origin: "https://evil.example" })
  const [err] = await once(ws, "error")
  assert.match(err.message, /403/)
  await srv.close()
})

test("returns an error for unhandled messages, closes malformed frames", async () => {
  const srv = await start()

  const anon = new WebSocket(`ws://127.0.0.1:${srv.port}/agent`)
  await once(anon, "open")
  anon.send(JSON.stringify({ v: 1, type: "open", id: "s1" }))
  assert.equal((await once(anon, "close"))[0], 4002)

  const authed = new WebSocket(`ws://127.0.0.1:${srv.port}/agent`)
  await once(authed, "open")
  authed.send(JSON.stringify({ v: 1, type: "auth", token: "test-token" }))
  await once(authed, "message")
  authed.send(JSON.stringify({ v: 1, type: "open", id: "s1" }))
  const reply = JSON.parse((await once(authed, "message"))[0])
  assert.equal(reply.type, "error")
  assert.equal(reply.id, "s1")
  authed.send("not json")
  assert.equal((await once(authed, "close"))[0], 4002)

  await srv.close()
})
