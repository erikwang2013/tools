const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const hessian = require("hessian.js")
const adapter = require("../adapters/hessian")

test("posts a hessian call and decodes the response", async () => {
  const server = http.createServer((req, res) => {
    const chunks = []
    req.on("data", chunk => chunks.push(chunk))
    req.on("end", () => {
      const decoded = new hessian.DecoderV2(Buffer.concat(chunks)).read()
      const encoder = new hessian.EncoderV2()
      encoder.write(["ok", ...decoded.slice(1)])
      res.writeHead(200, { "content-type": "x-application/hessian" })
      res.end(encoder.get())
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    { url: `http://127.0.0.1:${server.address().port}/`, method: "echo", headers: {} },
    event => events.push(event)
  )
  await session.send({ encoding: "utf8", data: '["hi"]' })
  const data = events.find(event => event.type === "data")
  assert.deepEqual(JSON.parse(data.payload.data), ["ok", "hi"])
  session.close()
  await new Promise(resolve => server.close(resolve))
})

test("reports non-2xx responses", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(500)
    res.end("no")
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const session = await adapter.create(
    { url: `http://127.0.0.1:${server.address().port}/`, method: "echo" },
    () => {}
  )
  await assert.rejects(session.send({ encoding: "utf8", data: "[]" }), /500/)
  session.close()
  await new Promise(resolve => server.close(resolve))
})
