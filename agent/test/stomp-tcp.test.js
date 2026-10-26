const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const { encodeFrame, FeedParser } = require("../lib/stomp")
const adapter = require("../adapters/stomp-tcp")

test("round-trips text and binary frames", () => {
  const parser = new FeedParser()
  const text = encodeFrame({ command: "MESSAGE", headers: { destination: "/q", "content-length": "2" }, body: "hi" })
  const binary = encodeFrame({ command: "MESSAGE", headers: { destination: "/b" }, body: Buffer.from([0, 1, 255]) })
  const frames = parser.push(Buffer.concat([Buffer.from("\n"), text, binary]))
  assert.equal(frames.length, 2)
  assert.equal(frames[0].headers.destination, "/q")
  assert.equal(frames[0].body.toString(), "hi")
  assert.deepEqual([...frames[1].body], [0, 1, 255])
})

test("buffers partial frames", () => {
  const frame = encodeFrame({ command: "CONNECTED", headers: { version: "1.2" }, body: "" })
  const parser = new FeedParser()
  assert.deepEqual(parser.push(frame.subarray(0, 5)), [])
  assert.equal(parser.push(frame.subarray(5))[0].command, "CONNECTED")
})

test("connects, subscribes, sends and receives", async () => {
  const received = []
  const server = net.createServer(socket => {
    const parser = new FeedParser()
    socket.on("data", chunk => {
      for (const frame of parser.push(chunk)) {
        received.push(frame.command)
        if (frame.command === "CONNECT") {
          socket.write(encodeFrame({ command: "CONNECTED", headers: { version: "1.2" } }))
          socket.write(
            encodeFrame({ command: "MESSAGE", headers: { destination: "/q" }, body: "hello" })
          )
        }
      }
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    {
      host: "127.0.0.1",
      port: server.address().port,
      login: "u",
      passcode: "p",
      subscribeDestination: "/q",
      sendDestination: "/q",
    },
    event => events.push(event)
  )
  session.send({ encoding: "utf8", data: "hi" })
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.ok(received.includes("SUBSCRIBE"))
  assert.ok(received.includes("SEND"))
  assert.equal(Buffer.from(events.find(event => event.type === "data").payload.data, "base64").toString(), "hello")
  session.close()
  await new Promise(resolve => server.close(resolve))
})
