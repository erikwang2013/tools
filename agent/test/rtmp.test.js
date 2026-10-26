const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const { encodeAmf0 } = require("../lib/amf0")
const { encodeChunk, RtmpChunkDecoder } = require("../lib/rtmp-chunk")
const adapter = require("../adapters/rtmp")

function command(values) {
  return encodeChunk({
    csid: 3,
    typeId: 20,
    streamId: 0,
    payload: Buffer.concat(values.map(encodeAmf0)),
  })
}

async function fixtureServer({ badVersion = false } = {}) {
  const commands = []
  const server = net.createServer(socket => {
    let buffer = Buffer.alloc(0)
    let handshaken = false
    let c2Received = false
    const decoder = new RtmpChunkDecoder()
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk])
      if (!handshaken) {
        if (buffer.length < 1537) return
        const c1 = buffer.subarray(1, 1537)
        buffer = buffer.subarray(1537)
        const s0 = Buffer.from([badVersion ? 2 : 3])
        const s1 = Buffer.alloc(1536)
        s1.writeUInt32BE(0, 0)
        socket.write(Buffer.concat([s0, s1, c1]))
        handshaken = true
        return
      }
      if (!c2Received) {
        if (buffer.length < 1536) return
        buffer = buffer.subarray(1536)
        c2Received = true
      }
      for (const message of decoder.push(buffer)) {
        buffer = Buffer.alloc(0)
        if (message.typeId !== 20) continue
        const values = []
        let offset = 0
        while (offset < message.payload.length) {
          const { decodeAmf0 } = require("../lib/amf0")
          const item = decodeAmf0(message.payload, offset)
          values.push(item.value)
          offset += item.consumed
        }
        commands.push(values[0])
        if (values[0] === "connect") {
          socket.write(
            command([
              "_result",
              1,
              { fmsVer: "FMS/3,0,1,123", capabilities: 31 },
              { level: "status", code: "NetConnection.Connect.Success" },
            ])
          )
        } else if (values[0] === "createStream") {
          socket.write(command(["_result", 2, null, 1]))
        }
      }
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  return {
    port: server.address().port,
    commands,
    close: () => new Promise(resolve => server.close(resolve)),
  }
}

test("connects, creates a stream and starts play", async () => {
  const fixture = await fixtureServer()
  const events = []
  const session = await adapter.create(
    { url: `rtmp://127.0.0.1:${fixture.port}/app/stream`, action: "play" },
    event => events.push(event)
  )
  assert.equal(session.ready.app, "app")
  assert.equal(session.ready.streamName, "stream")
  await new Promise(resolve => setTimeout(resolve, 200))
  assert.ok(fixture.commands.includes("connect"))
  assert.ok(fixture.commands.includes("createStream"))
  assert.ok(fixture.commands.includes("play"))
  session.close()
  await fixture.close()
})

test("reports a handshake version mismatch", async () => {
  const fixture = await fixtureServer({ badVersion: true })
  await assert.rejects(
    adapter.create({ url: `rtmp://127.0.0.1:${fixture.port}/app/stream`, action: "play" }, () => {}),
    /handshake/i
  )
  await fixture.close()
})
