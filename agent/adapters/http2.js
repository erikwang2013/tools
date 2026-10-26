const http2 = require("node:http2")
const { fromBuffer } = require("../lib/payload")

const ILLEGAL_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "upgrade",
  "host",
])

function cleanHeaders(headers = {}) {
  const out = {}
  for (const [name, value] of Object.entries(headers)) {
    if (!ILLEGAL_HEADERS.has(name.toLowerCase())) out[name] = String(value)
  }
  return out
}

module.exports = {
  id: "http2",
  create(config = {}, emit) {
    let target
    try {
      target = new URL(config.url)
    } catch {
      return Promise.reject(new Error("invalid url"))
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return Promise.reject(new Error("http2 requires an http(s) url"))
    }
    const origin = `${target.protocol}//${target.host}`
    const session = http2.connect(origin, {
      rejectUnauthorized: !config.allowSelfSigned,
    })
    let closed = false

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        closed = true
        session.destroy()
        reject(new Error("http2 connect timed out"))
      }, 30000)

      session.once("error", error => {
        clearTimeout(timer)
        if (!closed) {
          closed = true
          reject(error)
        }
      })

      session.once("connect", () => {
        clearTimeout(timer)
        resolve({
          ready: { protocol: "h2" },
          send(payload) {
            if (closed) throw new Error("session closed")
            return new Promise((resolveSend, rejectSend) => {
              const req = session.request({
                ":method": config.method || "GET",
                ":path": `${target.pathname}${target.search}`,
                ...cleanHeaders(config.headers),
              })
              const chunks = []
              req.on("response", headers => {
                emit({
                  type: "log",
                  payload: { level: "info", message: `HTTP/2 ${headers[":status"]}` },
                })
              })
              req.on("data", chunk => chunks.push(chunk))
              req.on("end", () => {
                const body = Buffer.concat(chunks)
                emit({ type: "data", payload: fromBuffer(body, { encoding: "base64" }) })
                emit({ type: "closed", payload: { reason: "response complete" } })
                resolveSend()
              })
              req.on("error", error => {
                emit({ type: "error", payload: { message: error.message } })
                emit({ type: "closed", payload: { reason: error.message } })
                rejectSend(error)
              })
              if (payload) {
                const body =
                  payload.encoding === "base64"
                    ? Buffer.from(payload.data, "base64")
                    : payload.data
                req.end(body)
              } else {
                req.end()
              }
            })
          },
          close() {
            if (closed) return
            closed = true
            session.close()
            session.destroy()
          },
        })
      })
    })
  },
}
