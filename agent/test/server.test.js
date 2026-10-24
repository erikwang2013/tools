const test = require("node:test")
const assert = require("node:assert/strict")
const { once } = require("node:events")
const WebSocket = require("ws")
const { createAgentServer } = require("../lib/server")
const { MAX_MESSAGE_BYTES } = require("../lib/envelope")

async function start(adapters = {}) {
  return createAgentServer({
    port: 0, token: "test-token", origins: [], allowNoOrigin: true, adapters,
  })
}

function next(ws) {
  return once(ws, "message").then(([raw]) => JSON.parse(raw))
}

async function authed(port) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/agent`)
  await once(ws, "open")
  ws.send(JSON.stringify({ v: 1, type: "auth", token: "test-token" }))
  assert.equal((await next(ws)).type, "auth:ok")
  return ws
}

function echoAdapter() {
  const calls = { sent: [], closed: 0 }
  return {
    calls,
    adapter: {
      id: "echo",
      async create(config, emit) {
        return {
          ready: { echoed: config.value },
          send(payload) {
            calls.sent.push(payload)
            emit({ type: "data", payload: { encoding: "utf8", data: payload.data, bytes: 1 } })
          },
          close() { calls.closed += 1 },
        }
      },
    },
  }
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
  assert.equal(badReply.error, "invalid token")

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
  authed.send(JSON.stringify({ v: 1, type: "log", id: "s1" }))
  const reply = JSON.parse((await once(authed, "message"))[0])
  assert.equal(reply.type, "error")
  assert.equal(reply.id, "s1")
  assert.equal(typeof reply.payload.message, "string")
  assert.equal(reply.error, undefined)
  authed.send(JSON.stringify({ v: 2, id: "x2" }))
  const decodeErr = JSON.parse((await once(authed, "message"))[0])
  assert.equal(decodeErr.type, "error")
  assert.equal(decodeErr.id, "x2")
  assert.equal(typeof decodeErr.payload.message, "string")
  assert.equal(decodeErr.error, undefined)
  authed.send("not json")
  assert.equal((await once(authed, "close"))[0], 4002)

  await srv.close()
})

test("closes pre-auth frames carrying an id", async () => {
  const srv = await start()
  const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/agent`)
  await once(ws, "open")
  ws.send(JSON.stringify({ v: 2, id: "x" }))
  assert.equal((await once(ws, "close"))[0], 4002)
  await srv.close()
})

test("opens, relays and closes a session over the socket", async () => {
  const { adapter, calls } = echoAdapter()
  const srv = await start({ echo: adapter })
  const ws = await authed(srv.port)

  ws.send(JSON.stringify({ v: 1, type: "open", id: "s1", protocol: "echo", config: { value: "ok" } }))
  const ready = await next(ws)
  assert.equal(ready.type, "ready")
  assert.equal(ready.id, "s1")
  assert.deepEqual(ready.payload, { echoed: "ok" })

  ws.send(JSON.stringify({ v: 1, type: "send", id: "s1", payload: { encoding: "utf8", data: "hi" } }))
  const data = await next(ws)
  assert.equal(data.type, "data")
  assert.equal(data.id, "s1")
  assert.deepEqual(calls.sent, [{ encoding: "utf8", data: "hi" }])

  ws.send(JSON.stringify({ v: 1, type: "close", id: "s1" }))
  const closed = await next(ws)
  assert.equal(closed.type, "closed")
  assert.equal(closed.id, "s1")
  assert.equal(calls.closed, 1)

  ws.close()
  await srv.close()
})

test("reports unknown sessions without dropping the connection", async () => {
  const { adapter } = echoAdapter()
  const srv = await start({ echo: adapter })
  const ws = await authed(srv.port)

  ws.send(JSON.stringify({ v: 1, type: "send", id: "ghost", payload: {} }))
  const sendErr = await next(ws)
  assert.equal(sendErr.type, "error")
  assert.equal(sendErr.id, "ghost")

  ws.send(JSON.stringify({ v: 1, type: "close", id: "ghost" }))
  const closeErr = await next(ws)
  assert.equal(closeErr.type, "error")
  assert.equal(closeErr.id, "ghost")

  ws.send(JSON.stringify({ v: 1, type: "open", id: "s1", protocol: "echo", config: { value: 1 } }))
  assert.equal((await next(ws)).type, "ready")
  ws.close()
  await srv.close()
})

test("turns an oversized outbound frame into a session error", async () => {
  let emitBig
  const adapter = {
    id: "big",
    async create(config, emit) {
      if (config.trigger) {
        emitBig = () => emit({
          type: "data",
          payload: { encoding: "utf8", data: "x".repeat(MAX_MESSAGE_BYTES), bytes: MAX_MESSAGE_BYTES },
        })
      }
      return { send() {}, close() {} }
    },
  }
  const srv = await start({ big: adapter })
  const ws = await authed(srv.port)

  ws.send(JSON.stringify({ v: 1, type: "open", id: "s1", protocol: "big", config: { trigger: true } }))
  assert.equal((await next(ws)).type, "ready")
  emitBig()
  const err = await next(ws)
  assert.equal(err.type, "error")
  assert.equal(err.id, "s1")
  assert.equal(err.payload.message, "message too large")

  ws.send(JSON.stringify({ v: 1, type: "open", id: "s2", protocol: "big", config: {} }))
  assert.equal((await next(ws)).type, "ready")
  ws.close()
  await srv.close()
})
