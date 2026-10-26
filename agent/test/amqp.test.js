const test = require("node:test")
const assert = require("node:assert/strict")
const adapter = require("../adapters/amqp")

test("validates required AMQP settings", async () => {
  await assert.rejects(adapter.create({}, () => {}), /url/)
  await assert.rejects(adapter.create({ url: "amqp://x", operation: "nope" }, () => {}), /operation/)
  await assert.rejects(
    adapter.create({ url: "amqp://x", operation: "consume" }, () => {}),
    /queue/
  )
})

test("fails fast when the broker is unreachable", async () => {
  await assert.rejects(
    adapter.create({ url: "amqp://127.0.0.1:1", operation: "publish", timeoutMs: 500 }, () => {}),
    error => /ECONNREFUSED|timeout|connect/i.test(error.message)
  )
})

const url = process.env.AMQP_URL
test("publishes and consumes a message", { skip: !url }, async () => {
  const events = []
  const session = await adapter.create(
    { url, operation: "consume", queue: "", timeoutMs: 5000 },
    event => events.push(event)
  )
  session.close()
})
