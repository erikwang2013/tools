const dgram = require("node:dgram")
const { toBuffer, fromBuffer } = require("../lib/payload")

const ENCODINGS = new Set(["utf8", "base64"])

// A loopback-bound UDP socket cannot receive replies from a LAN target, so only
// loopback targets get a loopback bind; everything else uses the wildcard address.
function bindAddress(host) {
  const name = host.trim().toLowerCase()
  if (name === "localhost" || name === "::1" || name === "[::1]") return "127.0.0.1"
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name)
  return ipv4 && ipv4[1] === "127" ? "127.0.0.1" : "0.0.0.0"
}

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

      socket.bind(bindPort, bindAddress(config.host), () => {
        opened = true
        const { address, port: localPort } = socket.address()
        resolve({
          ready: { address, port: localPort },
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
