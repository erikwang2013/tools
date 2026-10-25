const test = require("node:test")
const assert = require("node:assert/strict")
const dgram = require("node:dgram")
const {
  buildReadProperty,
  buildWhoIs,
  objectId,
  parseApdu,
  parseBvlc,
} = require("../lib/bacnet")
const adapter = require("../adapters/bacnet")

function bvlcResponse(apdu) {
  const npdu = Buffer.concat([Buffer.from([0x01, 0x00]), apdu])
  const header = Buffer.alloc(4)
  header[0] = 0x81
  header[1] = 0x0a
  header.writeUInt16BE(4 + npdu.length, 2)
  return Buffer.concat([header, npdu])
}

test("builds Who-Is and parses I-Am", () => {
  const whoIs = buildWhoIs()
  assert.equal(whoIs[0], 0x81)
  assert.equal(parseBvlc(whoIs).npdu[2], 0x10)
  const apdu = Buffer.alloc(12)
  apdu[0] = 0x10
  apdu[1] = 0x00
  apdu.writeUInt32BE(objectId(8, 1234), 2)
  apdu[6] = 0x05
  apdu.writeUInt16BE(42, 10)
  const parsed = parseApdu(Buffer.concat([Buffer.from([0x01, 0x00]), apdu]))
  assert.equal(parsed.type, "i-am")
  assert.equal(parsed.objectId, objectId(8, 1234))
  assert.equal(parsed.vendorId, 42)
})

test("parses a complex ACK", () => {
  const apdu = Buffer.alloc(15)
  apdu[0] = 0x30
  apdu[1] = 1
  apdu[2] = 0x0c
  apdu.writeUInt32BE(objectId(0, 1), 3)
  apdu[7] = 85
  apdu[8] = 0x3e
  apdu[9] = 0x44
  apdu.writeFloatBE(21.5, 10)
  apdu[14] = 0x3f
  const parsed = parseApdu(Buffer.concat([Buffer.from([0x01, 0x00]), apdu]))
  assert.equal(parsed.type, "complex-ack")
  assert.equal(parsed.values[0], 21.5)
})

test("reads a property from a mock BACnet device", async () => {
  const server = dgram.createSocket("udp4")
  server.on("message", (message, remote) => {
    const bvlc = parseBvlc(message)
    const apdu = bvlc.npdu.subarray(2)
    const invokeId = apdu[2]
    const response = Buffer.alloc(15)
    response[0] = 0x30
    response[1] = invokeId
    response[2] = 0x0c
    response.writeUInt32BE(objectId(0, 1), 3)
    response[7] = 85
    response[8] = 0x3e
    response[9] = 0x44
    response.writeFloatBE(7.5, 10)
    response[14] = 0x3f
    server.send(bvlcResponse(response), remote.port, remote.address)
  })
  await new Promise(resolve => server.bind(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    {
      target: "127.0.0.1",
      port: server.address().port,
      action: "readProperty",
      objectType: 0,
      instance: 1,
      property: 85,
    },
    event => events.push(event)
  )
  session.send()
  await new Promise(resolve => setTimeout(resolve, 100))
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  assert.equal(JSON.parse(data.payload.data).values[0], 7.5)
  session.close()
  server.close()
  assert.ok(buildReadProperty({ type: 0, instance: 1, property: 85 }))
})
