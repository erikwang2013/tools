const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const {
  U,
  FeedParser,
  encodeApdu,
  encodeUFrame,
  encodeAsdu,
  parseAsdu,
} = require("../lib/iec104")
const adapter = require("../adapters/iec104")

test("round-trips an I-frame", () => {
  const asdu = encodeAsdu({ typeId: 1, cause: 20, commonAddress: 1, ioa: 100, value: 1 })
  const apdu = encodeApdu({ type: "I", sendSeq: 5, recvSeq: 7, asdu })
  const [frame] = new FeedParser().push(apdu)
  assert.equal(frame.type, "I")
  assert.equal(frame.sendSeq, 5)
  assert.equal(frame.recvSeq, 7)
  assert.deepEqual(parseAsdu(frame.asdu).values, [{ ioa: 100, value: true, quality: 0 }])
})

test("parses U-frames", () => {
  const [frame] = new FeedParser().push(encodeUFrame(U.STARTDT_CON))
  assert.equal(frame.type, "U")
  assert.equal(frame.code, U.STARTDT_CON)
})

test("adapter starts a session and logs interrogation data", async () => {
  const server = net.createServer(socket => {
    const parser = new FeedParser()
    socket.on("data", chunk => {
      for (const frame of parser.push(chunk)) {
        if (frame.type === "U" && frame.code === U.STARTDT_ACT) {
          socket.write(encodeUFrame(U.STARTDT_CON))
        } else if (frame.type === "I") {
          const asdu = encodeAsdu({
            typeId: 1,
            cause: 20,
            commonAddress: 1,
            ioa: 100,
            value: 1,
          })
          socket.write(encodeApdu({ type: "I", sendSeq: 0, recvSeq: 1, asdu }))
        }
      }
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    { host: "127.0.0.1", port: server.address().port, commonAddress: 1, action: "interrogation" },
    event => events.push(event)
  )
  session.send()
  await new Promise(resolve => setTimeout(resolve, 100))
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  assert.equal(JSON.parse(data.payload.data).values[0].ioa, 100)
  session.close()
  await new Promise(resolve => server.close(resolve))
})
