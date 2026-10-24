const test = require("node:test")
const assert = require("node:assert/strict")
const dgram = require("node:dgram")
const udp = require("../adapters/udp")

test("sends a datagram, echoes base64 payloads and closes once", async () => {
  const server = dgram.createSocket("udp4")
  server.on("message", (msg, rinfo) => server.send(msg, rinfo.port, rinfo.address))
  await new Promise(r => server.bind(0, "127.0.0.1", r))
  const port = server.address().port
  const events = []
  const session = await udp.create(
    { host: "127.0.0.1", port, bindPort: 0, encoding: "base64" },
    e => events.push(e)
  )
  await session.send({ encoding: "utf8", data: "ping" })
  await new Promise(r => setTimeout(r, 100))
  const received = events.find(e => e.type === "data")
  assert.equal(received.payload.data, "cGluZw==")
  assert.equal(received.payload.bytes, 4)
  assert.match(received.payload.remote, /^127\.0\.0\.1:\d+$/)
  session.close()
  session.close()
  await new Promise(r => setTimeout(r, 50))
  assert.equal(events.filter(e => e.type === "closed").length, 1)
  assert.equal(events.at(-1).type, "closed")
  assert.throws(() => session.send({ encoding: "utf8", data: "late" }), /closed/)
  await new Promise(r => server.close(r))
})
