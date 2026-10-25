const test = require("node:test")
const assert = require("node:assert/strict")
const http2 = require("node:http2")
const adapter = require("../adapters/http2")

test("sends an h2c request and emits the response", async () => {
  const server = http2.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ path: req.url, method: req.method }))
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    { url: `http://127.0.0.1:${server.address().port}/x?y=1`, method: "POST", headers: {} },
    event => events.push(event)
  )
  assert.equal(session.ready.protocol, "h2")
  await session.send({ encoding: "utf8", data: "hi" })
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  assert.deepEqual(JSON.parse(Buffer.from(data.payload.data, "base64").toString()), {
    path: "/x?y=1",
    method: "POST",
  })
  assert.equal(events.filter(event => event.type === "closed").length, 1)
  session.close()
  await new Promise(resolve => server.close(resolve))
})
