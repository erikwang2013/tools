const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const grpc = require("@grpc/grpc-js")
const protoLoader = require("@grpc/proto-loader")
const adapter = require("../adapters/grpc")

const PROTO = fs.readFileSync(path.join(__dirname, "fixtures/echo.proto"), "utf8")

async function startServer() {
  const definition = grpc.loadPackageDefinition(
    protoLoader.loadSync(path.join(__dirname, "fixtures/echo.proto"), { keepCase: true })
  )
  const server = new grpc.Server()
  server.addService(definition.test.Echo.service, {
    Unary(call, callback) {
      callback(null, { text: `echo:${call.request.text}` })
    },
    Stream(call) {
      call.write({ text: "one" })
      call.write({ text: "two" })
      call.write({ text: "three" })
      call.end()
    },
  })
  const port = await new Promise((resolve, reject) => {
    server.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (error, bound) => {
      if (error) return reject(error)
      server.start()
      resolve(bound)
    })
  })
  return { server, port }
}

test("calls a unary method", async () => {
  const { server, port } = await startServer()
  const events = []
  const session = await adapter.create(
    {
      target: `127.0.0.1:${port}`,
      proto: PROTO,
      service: "test.Echo",
      method: "Unary",
      tls: false,
    },
    event => events.push(event)
  )
  assert.equal(session.ready.service, "test.Echo")
  session.send({ encoding: "utf8", data: JSON.stringify({ text: "hi" }) })
  await new Promise(resolve => setTimeout(resolve, 200))
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  assert.equal(JSON.parse(data.payload.data).text, "echo:hi")
  session.close()
  server.forceShutdown()
})

test("streams a server response", async () => {
  const { server, port } = await startServer()
  const events = []
  const session = await adapter.create(
    {
      target: `127.0.0.1:${port}`,
      proto: PROTO,
      service: "test.Echo",
      method: "Stream",
      tls: false,
    },
    event => events.push(event)
  )
  assert.equal(session.ready.streaming, true)
  session.send({ encoding: "utf8", data: JSON.stringify({ text: "hi" }) })
  await new Promise(resolve => setTimeout(resolve, 300))
  assert.equal(events.filter(event => event.type === "data").length, 3)
  session.close()
  server.forceShutdown()
})

test("rejects an invalid proto", async () => {
  await assert.rejects(
    adapter.create(
      { target: "127.0.0.1:1", proto: "not a proto", service: "x", method: "y" },
      () => {}
    )
  )
})
