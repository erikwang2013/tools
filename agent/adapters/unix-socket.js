const net = require("node:net")
const { toBuffer, fromBuffer } = require("../lib/payload")

const ENCODINGS = new Set(["utf8", "base64"])

module.exports = {
  id: "unix-socket",
  create(config = {}, emit) {
    if (typeof config.path !== "string" || config.path.trim() === "") {
      return Promise.reject(new Error("invalid path"))
    }
    const encoding = config.encoding || "base64"
    if (!ENCODINGS.has(encoding)) return Promise.reject(new Error("unsupported encoding"))

    return new Promise((resolve, reject) => {
      const socket = net.connect({ path: config.path })
      let opened = false
      let closed = false

      socket.on("connect", () => {
        opened = true
        resolve({
          send(payload) {
            if (closed) throw new Error("socket closed")
            socket.write(toBuffer(payload))
          },
          close() {
            if (closed) return
            closed = true
            socket.destroy()
          },
        })
      })
      socket.on("data", buf => emit({ type: "data", payload: fromBuffer(buf, { encoding }) }))
      socket.on("error", error => {
        if (opened) emit({ type: "error", payload: { message: error.message } })
        else reject(error)
      })
      socket.on("close", () => {
        if (opened) emit({ type: "closed", payload: { reason: "socket closed" } })
      })
    })
  },
}
