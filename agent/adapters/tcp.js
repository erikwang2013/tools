const net = require("node:net")
const { toBuffer, fromBuffer } = require("../lib/payload")

const ENCODINGS = new Set(["utf8", "base64"])

module.exports = {
  id: "tcp",
  create(config, emit) {
    if (!config || typeof config.host !== "string" || config.host.trim() === "") {
      return Promise.reject(new Error("invalid host"))
    }
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    const encoding = config.encoding || "base64"
    if (!ENCODINGS.has(encoding)) return Promise.reject(new Error("unsupported encoding"))

    return new Promise((resolve, reject) => {
      const socket = net.connect({ host: config.host, port })
      let opened = false

      socket.on("connect", () => {
        opened = true
        resolve({
          send(payload) {
            if (!socket.writable) throw new Error("socket not writable")
            socket.write(toBuffer(payload))
          },
          close() {
            socket.destroy()
          },
        })
      })

      socket.on("data", buf => {
        emit({ type: "data", payload: fromBuffer(buf, { encoding }) })
      })

      socket.on("error", err => {
        if (opened) emit({ type: "error", payload: { message: err.message } })
        else reject(err)
      })

      socket.on("close", () => {
        if (opened) emit({ type: "closed", payload: { reason: "socket closed" } })
      })
    })
  },
}
