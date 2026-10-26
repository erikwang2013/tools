const { Kafka } = require("kafkajs")

module.exports = {
  id: "kafka",
  create(config = {}, emit) {
    const brokers = String(config.brokers || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean)
    if (!brokers.length) return Promise.reject(new Error("brokers is required"))
    if (!config.topic) return Promise.reject(new Error("topic is required"))
    const operation = config.operation || "produce"
    if (!["produce", "consume"].includes(operation)) {
      return Promise.reject(new Error("unsupported operation"))
    }
    const timeoutMs = Number(config.timeoutMs) || 30000
    const kafka = new Kafka({
      clientId: "postwoman-agent",
      brokers,
      connectionTimeout: timeoutMs,
      retry: { retries: 0 },
    })
    let producer
    let consumer
    let closed = false

    const close = async () => {
      if (closed) return
      closed = true
      try {
        if (producer) await producer.disconnect()
        if (consumer) await consumer.disconnect()
      } catch {}
    }

    if (operation === "produce") {
      producer = kafka.producer()
      return producer
        .connect()
        .then(() => ({
          ready: { operation, topic: config.topic },
          async send(payload) {
            if (closed) throw new Error("connection closed")
            const value = payload
              ? payload.encoding === "base64"
                ? Buffer.from(payload.data, "base64")
                : Buffer.from(payload.data)
              : null
            await producer.send({
              topic: config.topic,
              messages: [
                {
                  key: config.key || null,
                  value,
                  headers: config.headers || {},
                },
              ],
            })
            emit({ type: "log", payload: { level: "info", message: "Kafka message produced" } })
          },
          close,
        }))
        .catch(async error => {
          await close()
          throw error
        })
    }

    consumer = kafka.consumer({ groupId: config.groupId || `postwoman-${Date.now().toString(36)}` })
    return consumer
      .connect()
      .then(async () => {
        await consumer.subscribe({ topic: config.topic, fromBeginning: Boolean(config.fromBeginning) })
        await consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            emit({
              type: "data",
              payload: {
                encoding: "base64",
                data: message.value ? message.value.toString("base64") : "",
                bytes: message.value ? message.value.length : 0,
                remote: `${topic}:${partition}:${message.offset}`,
              },
            })
          },
        })
        return {
          ready: { operation, topic: config.topic },
          send() {},
          close,
        }
      })
      .catch(async error => {
        await close()
        throw error
      })
  },
}
