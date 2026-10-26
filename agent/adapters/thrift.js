const net = require("node:net")
const { parseThriftIdl } = require("../lib/thrift-idl")
const { decodeThriftResult, encodeThriftCall } = require("../lib/thrift")

module.exports = {
  id: "thrift",
  create(config = {}, emit) {
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    if (!config.idl) return Promise.reject(new Error("idl is required"))
    if (!config.service) return Promise.reject(new Error("service is required"))
    if (!config.method) return Promise.reject(new Error("method is required"))
    let proto
    try {
      proto = parseThriftIdl(config.idl)
    } catch (error) {
      return Promise.reject(error)
    }
    if (!proto.services[config.service]) {
      return Promise.reject(new Error(`Service ${config.service} not found`))
    }
    if (!proto.services[config.service].methods.some(method => method.name === config.method)) {
      return Promise.reject(new Error(`Method ${config.method} not found`))
    }

    const socket = net.connect({ host: config.host, port })
    let buffer = Buffer.alloc(0)
    let timer
    let closed = false

    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk])
      for (;;) {
        try {
          const result = decodeThriftResult(buffer, { method: config.method, proto })
          buffer = buffer.subarray(result.consumed)
          clearTimeout(timer)
          emit({ type: "data", payload: { encoding: "utf8", data: JSON.stringify(result.value) } })
        } catch (error) {
          if (/Incomplete/.test(error.message)) break
          clearTimeout(timer)
          emit({ type: "error", payload: { message: error.message } })
          buffer = Buffer.alloc(0)
          break
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
          ready: { service: config.service, method: config.method },
          send(payload) {
            if (closed) throw new Error("socket closed")
            let args
            try {
              args = JSON.parse(payload && payload.encoding === "utf8" ? payload.data : "{}")
            } catch {
              throw new Error("Thrift args must be JSON")
            }
            socket.write(
              encodeThriftCall({
                service: config.service,
                method: config.method,
                args,
                proto,
              })
            )
            clearTimeout(timer)
            timer = setTimeout(
              () => emit({ type: "error", payload: { message: "Thrift response timed out" } }),
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
