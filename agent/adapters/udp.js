const dgram = require("node:dgram")
const { toBuffer, fromBuffer } = require("../lib/payload")

const ENCODINGS = new Set(["utf8", "base64"])

module.exports = {
  id: "udp",
  create(config, emit) {
    if (!config || typeof config.host !== "string" || config.host.trim() === "") {
      return Promise.reject(new Error("invalid host"))
    }
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    const bindPort = config.bindPort === undefined ? 0 : Number(config.bindPort)
    if (!Number.isInteger(bindPort) || bindPort < 0 || bindPort > 65535) {
      return Promise.reject(new Error("invalid bindPort"))
    }
    const encoding = config.encoding || "base64"
    if (!ENCODINGS.has(encoding)) return Promise.reject(new Error("unsupported encoding"))

    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket("udp4")
      let opened = false
      let closed = false

      socket.on("message", (buf, rinfo) => {
        emit({
          type: "data",
          payload: {
            ...fromBuffer(buf, { encoding }),
            remote: `${rinfo.address}:${rinfo.port}`,
          },
        })
      })

      socket.on("error", err => {
        if (opened) emit({ type: "error", payload: { message: err.message } })
        else {
          reject(err)
          try {
            socket.close()
          } catch {}
        }
      })

      socket.on("close", () => {
        if (opened) emit({ type: "closed", payload: { reason: "socket closed" } })
      })

      socket.bind(bindPort, () => {
        opened = true
        resolve({
          send(payload) {
            if (closed) throw new Error("socket closed")
            socket.send(toBuffer(payload), port, config.host)
          },
          close() {
            if (closed) return
            closed = true
            socket.close()
          },
        })
      })
    })
  },
}
