const coap = require("coap")
const { toBuffer } = require("../lib/payload")

module.exports = {
  id: "coap",
  create(config = {}, emit) {
    if (!config.url) return Promise.reject(new Error("url is required"))
    if (!/^coap:\/\//i.test(config.url)) {
      return Promise.reject(new Error("only coap:// urls are supported"))
    }
    let request
    try {
      request = coap.request(config.url)
    } catch (error) {
      return Promise.reject(error)
    }
    const method = (config.method || "GET").toUpperCase()
    request.method = method
    if (config.accept) request.setOption("Accept", config.accept)
    if (config.contentType) request.setOption("Content-Format", config.contentType)
    if (config.observe) request.setOption("Observe", 0)
    const timer = setTimeout(() => {
      emit({ type: "error", payload: { message: "CoAP request timed out" } })
      try {
        request.reset()
      } catch {}
    }, Number(config.timeoutMs) || 30000)
    let closed = false

    request.on("response", response => {
      const chunks = []
      response.on("data", chunk => chunks.push(chunk))
      response.on("end", () => {
        const body = Buffer.concat(chunks)
        const code = String(response.code)
        if (/^[45]\./.test(code)) {
          emit({ type: "error", payload: { message: `CoAP ${code}` } })
        } else {
          emit({
            type: "data",
            payload: { encoding: "base64", data: body.toString("base64"), bytes: body.length },
          })
        }
        if (!config.observe) {
          clearTimeout(timer)
          emit({ type: "closed", payload: { reason: "response complete" } })
        }
      })
    })
    request.on("error", error => {
      clearTimeout(timer)
      emit({ type: "error", payload: { message: error.message } })
      emit({ type: "closed", payload: { reason: error.message } })
    })

    return Promise.resolve({
      ready: { observing: Boolean(config.observe) },
      send(payload) {
        if (closed) throw new Error("session closed")
        const body = payload ? toBuffer(payload) : null
        if (body) request.write(body)
        request.end()
      },
      close() {
        if (closed) return
        closed = true
        clearTimeout(timer)
        try {
          request.reset()
        } catch {}
      },
    })
  },
}
