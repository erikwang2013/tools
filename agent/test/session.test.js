const test = require("node:test")
const assert = require("node:assert/strict")
const { SessionManager } = require("../lib/session")

function fakeAdapter() {
  const calls = { sent: [], closed: 0 }
  return {
    calls,
    adapter: {
      id: "fake",
      async create(config, emit) {
        return {
          ready: { echoed: config.value },
          send(payload) { calls.sent.push(payload); emit({ type: "data", payload: { encoding: "utf8", data: payload.data, bytes: 1 } }) },
          close() { calls.closed += 1 },
        }
      },
    },
  }
}

test("opens, sends, closes and emits with session id", async () => {
  const { adapter, calls } = fakeAdapter()
  const events = []
  const mgr = new SessionManager({ adapters: { fake: adapter }, emit: (id, e) => events.push([id, e]) })
  const { ready } = await mgr.open("s1", "fake", { value: "ok" })
  assert.deepEqual(ready, { echoed: "ok" })
  await mgr.send("s1", { encoding: "utf8", data: "hi" })
  assert.deepEqual(calls.sent, [{ encoding: "utf8", data: "hi" }])
  assert.equal(events[0][0], "s1")
  mgr.close("s1")
  assert.equal(calls.closed, 1)
  assert.deepEqual(events.at(-1), [
    "s1",
    { type: "closed", payload: { reason: "closed by client" } },
  ])
  mgr.close("s1")
  assert.equal(calls.closed, 1, "close must be idempotent")
})

test("rejects unknown protocol and enforces max sessions", async () => {
  const { adapter } = fakeAdapter()
  const mgr = new SessionManager({ adapters: { fake: adapter }, emit: () => {}, maxSessions: 1 })
  await assert.rejects(() => mgr.open("a", "nope", {}), /unknown protocol/i)
  await mgr.open("a", "fake", { value: 1 })
  await assert.rejects(() => mgr.open("b", "fake", { value: 2 }), /too many sessions/i)
})

test("times out a hanging open", async () => {
  const adapter = { id: "hang", create: () => new Promise(() => {}) }
  const events = []
  const mgr = new SessionManager({
    adapters: { hang: adapter },
    emit: (id, e) => events.push(e),
    openTimeoutMs: 10,
  })
  await assert.rejects(() => mgr.open("a", "hang", {}), /timed out/i)
  assert.match(events.at(-1).payload.reason, /timed out/i)
})

test("emits error then closed when the adapter fails to start", async () => {
  const events = []
  const adapter = { id: "boom", create: async () => { throw new Error("boom") } }
  const mgr = new SessionManager({ adapters: { boom: adapter }, emit: (id, e) => events.push(e) })
  await assert.rejects(() => mgr.open("a", "boom", {}), /boom/)
  assert.deepEqual(events.map(e => e.type), ["error", "closed"])
  assert.equal(events.at(-1).payload.reason, "boom")
  await assert.rejects(() => mgr.send("a", {}), /unknown session/i)
})

test("closes an adapter that resolves after the open timeout", async () => {
  let closed = 0
  const adapter = {
    id: "late",
    create: () => new Promise(resolve => setTimeout(
      () => resolve({ send() {}, close() { closed += 1 } }),
      20
    )),
  }
  const mgr = new SessionManager({ adapters: { late: adapter }, emit: () => {}, openTimeoutMs: 5 })
  await assert.rejects(() => mgr.open("a", "late", {}), /timed out/i)
  await new Promise(resolve => setTimeout(resolve, 60))
  assert.equal(closed, 1)
})

test("closes a late adapter after a close during open and emits one closed", async () => {
  const events = []
  let closed = 0
  const adapter = {
    id: "late",
    create: () => new Promise(resolve => setTimeout(
      () => resolve({ send() {}, close() { closed += 1 } }),
      30
    )),
  }
  const mgr = new SessionManager({
    adapters: { late: adapter },
    emit: (id, e) => events.push(e),
    openTimeoutMs: 5,
  })
  const opening = mgr.open("a", "late", {})
  assert.equal(mgr.close("a"), true)
  await assert.rejects(() => opening, /timed out/i)
  await new Promise(resolve => setTimeout(resolve, 70))
  assert.equal(closed, 1)
  assert.deepEqual(events.map(e => e.type), ["closed"])
  await assert.rejects(() => mgr.send("a", {}), /unknown session/i)
})

test("releases a session when the adapter closes itself", async () => {
  let emitClosed
  let adapterCloses = 0
  const adapter = {
    id: "self",
    async create(config, emit) {
      emitClosed = () => emit({ type: "closed", payload: { reason: "socket died" } })
      return { send() {}, close() { adapterCloses += 1 } }
    },
  }
  const events = []
  const mgr = new SessionManager({
    adapters: { self: adapter },
    emit: (id, e) => events.push([id, e]),
    maxSessions: 1,
  })
  await mgr.open("a", "self", {})
  emitClosed()
  assert.deepEqual(events, [["a", { type: "closed", payload: { reason: "socket died" } }]])
  await assert.rejects(() => mgr.send("a", {}), /unknown session/i)
  await mgr.open("a", "self", {}) // the id and the maxSessions slot are free again
  mgr.closeAll()
  mgr.closeAll()
  assert.equal(adapterCloses, 1, "the self-closed adapter must not be closed again")
})
