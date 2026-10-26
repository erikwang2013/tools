const net = require("node:net")
const { decodeIso8583, encodeIso8583, stripLengthHeader } = require("../lib/iso8583")

module.exports = {
  id: "iso8583",
  create(config = {}, emit) {
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    const lengthHeader = config.lengthHeader || "none"
    const lengthEncoding = config.lengthEncoding || "ascii"
    const timeoutMs = Number(config.timeoutMs) || 30000
    const socket = net.connect({ host: config.host, port })
    let buffer = Buffer.alloc(0)
    let timer
    let closed = false

    const arm = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        emit({ type: "error", payload: { message: "ISO 8583 response timed out" } })
      }, timeoutMs)
    }

    const handleMessage = raw => {
      clearTimeout(timer)
      try {
        const message = decodeIso8583(raw, { lengthHeader, lengthEncoding })
        emit({
          type: "data",
          payload: {
            encoding: "utf8",
            data: JSON.stringify(message, null, 2),
            bytes: raw.length,
          },
        })
      } catch (error) {
        emit({ type: "log", payload: { level: "error", message: error.message } })
        emit({ type: "data", payload: { encoding: "base64", data: raw.toString("base64"), bytes: raw.length } })
      }
    }

    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk])
      if (lengthHeader === "none") {
        handleMessage(buffer)
        buffer = Buffer.alloc(0)
        return
      }
      for (;;) {
        const header = stripLengthHeader(buffer, lengthHeader, lengthEncoding)
        if (header.incomplete) break
        if (buffer.length < header.size + header.length) break
        const raw = buffer.subarray(0, header.size + header.length)
        buffer = buffer.subarray(header.size + header.length)
        handleMessage(raw)
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
          ready: { lengthHeader, lengthEncoding },
          send(payload) {
            if (closed) throw new Error("socket closed")
            let message
            try {
              message = JSON.parse(payload.encoding === "utf8" ? payload.data : Buffer.from(payload.data, "base64").toString())
            } catch {
              throw new Error("ISO 8583 payload must be JSON")
            }
            socket.write(encodeIso8583(message, { lengthHeader, lengthEncoding }))
            arm()
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
