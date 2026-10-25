const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const dgram = require("node:dgram")
const adapter = require("../adapters/raw-socket")

test("raw-socket forwards TCP traffic", async () => {
  const server = net.createServer(socket => socket.pipe(socket))
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    { kind: "tcp", host: "127.0.0.1", port: server.address().port, encoding: "utf8" },
    event => events.push(event)
  )
  session.send({ encoding: "utf8", data: "hi" })
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(events.find(event => event.type === "data").payload.data, "hi")
  session.close()
  await new Promise(resolve => server.close(resolve))
})

test("raw-socket forwards UDP traffic", async () => {
  const socket = dgram.createSocket("udp4")
  socket.on("message", (message, remote) => socket.send(message, remote.port, remote.address))
  await new Promise(resolve => socket.bind(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    { kind: "udp", host: "127.0.0.1", port: socket.address().port, bindPort: 0, encoding: "utf8" },
    event => events.push(event)
  )
  session.send({ encoding: "utf8", data: "hi" })
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(events.find(event => event.type === "data").payload.data, "hi")
  session.close()
  socket.close()
})
