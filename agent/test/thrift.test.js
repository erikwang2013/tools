const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const { parseThriftIdl } = require("../lib/thrift-idl")
const { decodeThriftResult, encodeThriftReply } = require("../lib/thrift")
const adapter = require("../adapters/thrift")

const IDL = `
namespace js test
service Echo {
  string echo(1: string text)
}
`

test("parses services and method args", () => {
  const out = parseThriftIdl(IDL)
  assert.equal(out.services.Echo.methods[0].name, "echo")
  assert.deepEqual(out.services.Echo.methods[0].args, [{ id: 1, name: "text", type: "string" }])
})

test("rejects unsupported thrift types", () => {
  assert.throws(() => parseThriftIdl("service S { string m(1: uuid x) }"), /Unsupported Thrift type uuid/i)
})

test("decodes a reply", () => {
  const proto = parseThriftIdl(IDL)
  const reply = encodeThriftReply({ name: "echo", returnType: "string", value: "ok" })
  assert.equal(decodeThriftResult(reply, { method: "echo", proto }).value, "ok")
})

test("adapter calls a mock Thrift server", async () => {
  const proto = parseThriftIdl(IDL)
  const server = net.createServer(socket => {
    socket.once("data", () => {
      socket.write(encodeThriftReply({ name: "echo", returnType: "string", value: "ok" }))
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    {
      host: "127.0.0.1",
      port: server.address().port,
      idl: IDL,
      service: "Echo",
      method: "echo",
    },
    event => events.push(event)
  )
  session.send({ encoding: "utf8", data: JSON.stringify({ text: "hi" }) })
  await new Promise(resolve => setTimeout(resolve, 100))
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  assert.equal(JSON.parse(data.payload.data), "ok")
  session.close()
  await new Promise(resolve => server.close(resolve))
})
