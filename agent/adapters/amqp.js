const amqp = require("amqplib")
const { toBuffer } = require("../lib/payload")

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

module.exports = {
  id: "amqp",
  create(config = {}, emit) {
    if (!config.url) return Promise.reject(new Error("url is required"))
    const operation = config.operation || "publish"
    if (!["publish", "consume"].includes(operation)) {
      return Promise.reject(new Error("unsupported operation"))
    }
    if (operation === "consume" && !config.queue) {
      return Promise.reject(new Error("queue is required for consume"))
    }
    const timeoutMs = Number(config.timeoutMs) || 30000
    let connection
    let channel
    let tag
    let closed = false

    return withTimeout(amqp.connect(config.url), timeoutMs, "AMQP connect")
      .then(async conn => {
        connection = conn
        conn.on("error", error => emit({ type: "error", payload: { message: error.message } }))
        conn.on("close", () => {
          if (closed) return
          closed = true
          emit({ type: "closed", payload: { reason: "connection closed" } })
        })
        channel = await conn.createChannel()
        if (config.queue) {
          await channel.assertQueue(config.queue, { durable: false, autoDelete: true })
        }
        if (operation === "consume") {
          channel.prefetch(Number(config.prefetch) || 1)
          const reply = await channel.consume(config.queue, message => {
            if (!message) return
            emit({
              type: "data",
              payload: {
                encoding: "base64",
                data: message.content.toString("base64"),
                bytes: message.content.length,
                remote: message.fields.routingKey,
              },
            })
            channel.ack(message)
          })
          tag = reply.consumerTag
        }
        return {
          ready: { operation },
          send(payload) {
            if (closed) throw new Error("connection closed")
            if (operation !== "publish") return
            const body = toBuffer(payload)
            channel.publish(
              config.exchange || "",
              config.routingKey || config.queue || "",
              body,
              { headers: config.headers || {}, contentType: "application/octet-stream" }
            )
          },
          async close() {
            if (closed) return
            closed = true
            try {
              if (tag && channel) await channel.cancel(tag)
              if (channel) await channel.close()
              if (connection) await connection.close()
            } catch {}
          },
        }
      })
  },
}
