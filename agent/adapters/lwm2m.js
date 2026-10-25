const coap = require("coap")
const { buildObjectPath, buildRegisterPayload } = require("../lib/lwm2m")

function request(baseUrl, method, path, { payload, contentType, observe } = {}) {
  return new Promise((resolve, reject) => {
    const url = `${String(baseUrl).replace(/\/$/, "")}${path}`
    const req = coap.request(url)
    req.method = method
    if (contentType !== undefined) req.setOption("Content-Format", contentType)
    if (observe) req.setOption("Observe", 0)
    const timer = setTimeout(() => {
      req.reset()
      reject(new Error("LwM2M request timed out"))
    }, 30000)
    req.on("response", res => {
      const chunks = []
      res.on("data", chunk => chunks.push(chunk))
      res.on("end", () => {
        clearTimeout(timer)
        resolve({ code: String(res.code), options: res.options || [], body: Buffer.concat(chunks) })
      })
    })
    req.on("error", error => {
      clearTimeout(timer)
      reject(error)
    })
    if (payload) req.write(payload)
    req.end()
  })
}

module.exports = {
  id: "lwm2m",
  create(config = {}, emit) {
    if (!config.serverUrl) return Promise.reject(new Error("serverUrl is required"))
    if (!config.endpointName) return Promise.reject(new Error("endpointName is required"))
    const action = config.action || "register"
    if (!["register", "read", "write", "observe"].includes(action)) {
      return Promise.reject(new Error("unsupported action"))
    }
    let location = ""
    let closed = false
    let observeRequest = null

    const register = async () => {
      const { query, body } = buildRegisterPayload({
        endpoint: config.endpointName,
        objects: config.objects ? String(config.objects).split(",").map(value => value.trim()) : ["/3/0"],
        lifetime: config.lifetime,
      })
      const response = await request(config.serverUrl, "POST", `/rd?${query}`, {
        payload: Buffer.from(body),
        contentType: 40,
      })
      if (!/^2\./.test(response.code)) throw new Error(`LwM2M register failed: ${response.code}`)
      location = response.options
        .filter(option => option.name === "Location-Path" || option.name === "Location Path")
        .map(option => option.value)
        .join("/")
      if (!location) throw new Error("LwM2M register response is missing Location-Path")
    }

    return register().then(() => ({
      ready: { location },
      async send(payload) {
        if (closed) throw new Error("session closed")
        if (action === "register") return
        const path = buildObjectPath(config.objectPath || "/3/0/1")
        if (action === "observe") {
          const url = `${String(config.serverUrl).replace(/\/$/, "")}/${location}${path}`
          observeRequest = coap.request(url)
          observeRequest.method = "GET"
          observeRequest.setOption("Observe", 0)
          observeRequest.on("response", response => {
            response.on("data", chunk => {
              emit({
                type: "data",
                payload: {
                  encoding: "base64",
                  data: chunk.toString("base64"),
                  bytes: chunk.length,
                },
              })
            })
          })
          observeRequest.end()
          return
        }
        if (action === "read") {
          const response = await request(config.serverUrl, "GET", `/${location}${path}`)
          if (!/^2\./.test(response.code)) throw new Error(`LwM2M read failed: ${response.code}`)
          emit({
            type: "data",
            payload: {
              encoding: "base64",
              data: response.body.toString("base64"),
              bytes: response.body.length,
            },
          })
          return
        }
        const response = await request(config.serverUrl, "PUT", `/${location}${path}`, {
          payload: payload ? Buffer.from(payload.data, payload.encoding === "base64" ? "base64" : "utf8") : Buffer.alloc(0),
          contentType: 0,
        })
        if (!/^2\./.test(response.code)) throw new Error(`LwM2M write failed: ${response.code}`)
        emit({ type: "log", payload: { level: "info", message: `LwM2M write ${response.code}` } })
      },
      close() {
        closed = true
        if (observeRequest) {
          try {
            observeRequest.reset()
          } catch {}
        }
      },
    }))
  },
}
