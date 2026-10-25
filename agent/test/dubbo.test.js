const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const hessian = require("hessian.js")
const { decodeDubboResponse, encodeDubboRequest, responseFrame } = require("../lib/dubbo")
const adapter = require("../adapters/dubbo")

test("encodes magic, request id and hessian2 body", () => {
  const buffer = encodeDubboRequest({
    requestId: 7,
    interfaceName: "com.x.S",
    version: "1.0.0",
    method: "hi",
    parameterTypes: ["java.lang.String"],
    args: ["a"],
  })
  assert.equal(buffer.readUInt16BE(0), 0xdabb)
  assert.equal(buffer[2] & 0x80, 0x80)
  assert.equal(buffer.readBigInt64BE(4), 7n)
  assert.equal(buffer.readUInt32BE(12), buffer.length - 16)
})

test("decodes a canned success response", () => {
  const encoder = new hessian.EncoderV2()
  encoder.write([null, "ok"])
  const frame = responseFrame({ requestId: 1, body: encoder.get() })
  assert.deepEqual(decodeDubboResponse(frame), { status: 20, ok: true, result: "ok" })
})

test("adapter calls a mock Dubbo server", async () => {
  const server = net.createServer(socket => {
    let buffer = Buffer.alloc(0)
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk])
      if (buffer.length < 16) return
      const length = buffer.readUInt32BE(12)
      if (buffer.length < 16 + length) return
      const requestId = buffer.readBigInt64BE(4)
      const encoder = new hessian.EncoderV2()
      encoder.write([null, "ok"])
      socket.write(responseFrame({ requestId, body: encoder.get() }))
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    {
      host: "127.0.0.1",
      port: server.address().port,
      interface: "com.x.S",
      method: "hi",
      parameterTypes: "java.lang.String",
    },
    event => events.push(event)
  )
  session.send({ encoding: "utf8", data: '["a"]' })
  await new Promise(resolve => setTimeout(resolve, 100))
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  assert.equal(JSON.parse(data.payload.data).result, "ok")
  session.close()
  await new Promise(resolve => server.close(resolve))
})
