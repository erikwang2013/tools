const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const tcp = require("../adapters/tcp")

test("connects, echoes data and emits base64 payloads", async () => {
  const server = net.createServer(socket => socket.pipe(socket))
  await new Promise(r => server.listen(0, "127.0.0.1", r))
  const port = server.address().port
  const events = []
  const session = await tcp.create(
    { host: "127.0.0.1", port, encoding: "base64" },
    e => events.push(e)
  )
  await session.send({ encoding: "utf8", data: "ping" })
  await new Promise(r => setTimeout(r, 100))
  assert.equal(events.some(e => e.type === "data" && e.payload.data === "cGluZw=="), true)
  session.close()
  await new Promise(r => setTimeout(r, 50))
  assert.equal(events.at(-1).type, "closed")
  await new Promise(r => server.close(r))
})
