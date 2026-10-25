const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const { encodeIso8583, decodeIso8583 } = require("../lib/iso8583")
const adapter = require("../adapters/iso8583")

const MESSAGE = {
  mti: "0200",
  fields: {
    2: "4111111111111111",
    3: "000000",
    4: "000000010000",
    7: "1024150000",
    11: "123456",
    41: "TERM0001",
    42: "MERCHANT0000001",
  },
}

test("round-trips a 0200 message with fixed and llvar fields", () => {
  for (const options of [
    { lengthHeader: "2", lengthEncoding: "ascii" },
    { lengthHeader: "4", lengthEncoding: "ascii" },
    { lengthHeader: "2", lengthEncoding: "binary" },
    { lengthHeader: "none" },
  ]) {
    const buffer = encodeIso8583(MESSAGE, options)
    assert.deepEqual(decodeIso8583(buffer, options), MESSAGE)
  }
})

test("rejects an unknown field", () => {
  assert.throws(() => encodeIso8583({ mti: "0200", fields: { 999: "x" } }, {}), /field 999/i)
})

test("adapter sends and decodes a response", async () => {
  const server = net.createServer(socket => {
    socket.once("data", chunk => {
      const request = decodeIso8583(chunk, { lengthHeader: "2", lengthEncoding: "ascii" })
      const response = encodeIso8583(
        { mti: "0210", fields: { ...request.fields, 39: "00" } },
        { lengthHeader: "2", lengthEncoding: "ascii" }
      )
      socket.write(response)
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    {
      host: "127.0.0.1",
      port: server.address().port,
      lengthHeader: "2",
      lengthEncoding: "ascii",
    },
    event => events.push(event)
  )
  session.send({ encoding: "utf8", data: JSON.stringify(MESSAGE) })
  await new Promise(resolve => setTimeout(resolve, 150))
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  const response = JSON.parse(data.payload.data)
  assert.equal(response.mti, "0210")
  assert.equal(response.fields[39], "00")
  session.close()
  await new Promise(resolve => server.close(resolve))
})
