const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const CRCLib = require("dnp3-crc")
const {
  buildLinkFrame,
  buildReadRequest,
  parseApplication,
  parseLinkFrame,
} = require("../lib/dnp3")
const adapter = require("../adapters/dnp3")

test("round-trips a link frame with CRC checks", () => {
  const userData = buildReadRequest()
  const frame = buildLinkFrame({ source: 1, destination: 10, userData })
  const parsed = parseLinkFrame(frame)
  assert.equal(parsed.source, 1)
  assert.equal(parsed.destination, 10)
  assert.deepEqual(parsed.userData, userData)
  assert.deepEqual(parseApplication(parsed.userData).objects[0], {
    group: 60,
    variation: 1,
    qualifier: 6,
  })
})

test("rejects a corrupted header CRC", () => {
  const frame = buildLinkFrame({ userData: buildReadRequest() })
  frame[8] ^= 0xff
  assert.throws(() => parseLinkFrame(frame), /CRC/)
})

test("adapter sends a read and receives a response", async () => {
  const server = net.createServer(socket => {
    let buffer = Buffer.alloc(0)
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk])
      const request = parseLinkFrame(buffer)
      if (!request) return
      const response = buildLinkFrame({
        source: 10,
        destination: 1,
        direction: "outstation",
        userData: Buffer.from([0xc0, 0x81, 60, 1, 0x06]),
      })
      socket.write(response)
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    { host: "127.0.0.1", port: server.address().port, masterAddress: 1, outstationAddress: 10 },
    event => events.push(event)
  )
  session.send()
  await new Promise(resolve => setTimeout(resolve, 100))
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  assert.ok(CRCLib.calculate(Buffer.from([1, 2, 3])))
  session.close()
  await new Promise(resolve => server.close(resolve))
})

test("validates addresses before connecting", async () => {
  await assert.rejects(
    adapter.create({ host: "127.0.0.1", port: 1, masterAddress: 70000 }, () => {}),
    /masterAddress/
  )
})
