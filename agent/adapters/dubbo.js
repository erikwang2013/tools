const net = require("node:net")
const { decodeDubboResponse, encodeDubboRequest } = require("../lib/dubbo")

module.exports = {
  id: "dubbo",
  create(config = {}, emit) {
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    if (!config.interface) return Promise.reject(new Error("interface is required"))
    if (!config.method) return Promise.reject(new Error("method is required"))
    const parameterTypes = String(config.parameterTypes || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean)
    const socket = net.connect({ host: config.host, port })
    let buffer = Buffer.alloc(0)
    let requestId = 0
    let timer
    let closed = false

    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 16) {
        const length = buffer.readUInt32BE(12)
        if (buffer.length < 16 + length) break
        const frame = buffer.subarray(0, 16 + length)
        buffer = buffer.subarray(16 + length)
        clearTimeout(timer)
        try {
          const response = decodeDubboResponse(frame)
          emit({
            type: "data",
            payload: { encoding: "utf8", data: JSON.stringify(response, null, 2) },
          })
          if (!response.ok) emit({ type: "error", payload: { message: `Dubbo status ${response.status}` } })
        } catch (error) {
          emit({ type: "error", payload: { message: error.message } })
        }
      }
    })
    socket.on("error", error => emit({ type: "error", payload: { message: error.message } }))
    socket.on("close", () => {
      clearTimeout(timer)
      if (!closed) {
        closed = true
        emit({ type: "closed", payload: { reason: "socket closed" } })
      }
    })

    return new Promise((resolve, reject) => {
      socket.once("connect", () => {
        resolve({
          ready: { interface: config.interface, method: config.method },
          send(payload) {
            if (closed) throw new Error("socket closed")
            let args
            try {
              args = JSON.parse(payload && payload.encoding === "utf8" ? payload.data : "[]")
            } catch {
              throw new Error("Dubbo args must be JSON")
            }
            if (!Array.isArray(args)) throw new Error("Dubbo args must be a JSON array")
            requestId += 1
            socket.write(
              encodeDubboRequest({
                requestId,
                interfaceName: config.interface,
                version: config.version || "1.0.0",
                method: config.method,
                parameterTypes,
                args,
              })
            )
            clearTimeout(timer)
            timer = setTimeout(
              () => emit({ type: "error", payload: { message: "Dubbo response timed out" } }),
              Number(config.timeoutMs) || 30000
            )
          },
          close() {
            if (closed) return
            closed = true
            clearTimeout(timer)
            socket.destroy()
          },
        })
      })
      socket.once("error", reject)
    })
  },
}
