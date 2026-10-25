const test = require("node:test")
const assert = require("node:assert/strict")
const adapter = require("../adapters/opcua")

test("validates required OPC UA settings", async () => {
  await assert.rejects(adapter.create({}, () => {}), /endpointUrl/)
  await assert.rejects(
    adapter.create({ endpointUrl: "opc.tcp://127.0.0.1:1", action: "nope" }, () => {}),
    /action/
  )
})

test("fails fast when the endpoint is unreachable", async () => {
  await assert.rejects(
    adapter.create(
      {
        endpointUrl: "opc.tcp://127.0.0.1:1",
        action: "read",
        nodeId: "ns=1;s=Demo",
      },
      () => {}
    ),
    error => /ECONNREFUSED|connect|timed out/i.test(error.message)
  )
})
