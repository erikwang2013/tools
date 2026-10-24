const net = require("node:net")
const { StringDecoder } = require("node:string_decoder")
const { toBuffer, fromBuffer } = require("../lib/payload")

const ENCODINGS = new Set(["utf8", "base64"])
const FRAMINGS = new Set(["none", "line"])

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
    const framing = config.framing || "none"
    if (!FRAMINGS.has(framing)) return Promise.reject(new Error("unsupported framing"))

    return new Promise((resolve, reject) => {
      const socket = net.connect({ host: config.host, port })
      let opened = false
      const decoder = new StringDecoder("utf8")
      let remainder = ""

      const emitLine = line => {
        const text = line.endsWith("\r") ? line.slice(0, -1) : line
        emit({ type: "data", payload: fromBuffer(Buffer.from(text, "utf8"), { encoding }) })
      }

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
        if (framing !== "line") {
          emit({ type: "data", payload: fromBuffer(buf, { encoding }) })
          return
        }
        remainder += decoder.write(buf)
        const lines = remainder.split("\n")
        remainder = lines.pop()
        for (const line of lines) emitLine(line)
      })

      socket.on("error", err => {
        if (opened) emit({ type: "error", payload: { message: err.message } })
        else reject(err)
      })

      socket.on("close", () => {
        if (!opened) return
        if (framing === "line") {
          remainder += decoder.end()
          if (remainder !== "") emitLine(remainder)
        }
        emit({ type: "closed", payload: { reason: "socket closed" } })
      })
    })
  },
}
