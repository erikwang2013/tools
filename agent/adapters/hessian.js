const hessian = require("hessian.js")

module.exports = {
  id: "hessian",
  create(config = {}, emit) {
    if (!config.url) return Promise.reject(new Error("url is required"))
    const controller = new AbortController()
    let closed = false

    return Promise.resolve({
      ready: { method: config.method || "" },
      async send(payload) {
        if (closed) throw new Error("session closed")
        let args
        try {
          args = JSON.parse(payload && payload.encoding === "utf8" ? payload.data : "[]")
        } catch {
          throw new Error("Hessian args must be JSON")
        }
        if (!Array.isArray(args)) throw new Error("Hessian args must be a JSON array")
        const encoder = new hessian.EncoderV2()
        encoder.write([config.method || "", ...args])
        const timeout = setTimeout(() => controller.abort(), Number(config.timeoutMs) || 30000)
        try {
          const response = await fetch(config.url, {
            method: "POST",
            headers: { "content-type": "x-application/hessian", ...(config.headers || {}) },
            body: encoder.get(),
            signal: controller.signal,
          })
          if (!response.ok) throw new Error(`Hessian request failed (${response.status})`)
          const buffer = Buffer.from(await response.arrayBuffer())
          const decoded = new hessian.DecoderV2(buffer).read()
          emit({ type: "data", payload: { encoding: "utf8", data: JSON.stringify(decoded) } })
          emit({ type: "closed", payload: { reason: "response complete" } })
        } finally {
          clearTimeout(timeout)
        }
      },
      close() {
        closed = true
        controller.abort()
      },
    })
  },
}
