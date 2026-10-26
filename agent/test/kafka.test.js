const test = require("node:test")
const assert = require("node:assert/strict")
const adapter = require("../adapters/kafka")

test("validates required Kafka settings", async () => {
  await assert.rejects(adapter.create({}, () => {}), /brokers/)
  await assert.rejects(adapter.create({ brokers: "127.0.0.1:1" }, () => {}), /topic/)
  await assert.rejects(
    adapter.create({ brokers: "127.0.0.1:1", topic: "t", operation: "nope" }, () => {}),
    /operation/
  )
})

const brokers = process.env.KAFKA_BROKERS
test("produces a message", { skip: !brokers }, async () => {
  const session = await adapter.create(
    { brokers, topic: process.env.KAFKA_TOPIC || "postwoman", operation: "produce" },
    () => {}
  )
  await session.send({ encoding: "utf8", data: "hi" })
  await session.close()
})
