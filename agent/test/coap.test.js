const test = require("node:test")
const assert = require("node:assert/strict")
const coap = require("coap")
const adapter = require("../adapters/coap")

test("sends a CoAP request and receives the response", async () => {
  const server = coap.createServer((req, res) => {
    res.code = "2.05"
    res.end(req.payload)
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const port = server._sock.address().port
  const events = []
  const session = await adapter.create(
    { url: `coap://127.0.0.1:${port}/x`, method: "POST" },
    event => events.push(event)
  )
  session.send({ encoding: "utf8", data: "hi" })
  await new Promise(resolve => setTimeout(resolve, 150))
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  assert.equal(Buffer.from(data.payload.data, "base64").toString(), "hi")
  session.close()
  await new Promise(resolve => server.close(resolve))
})
