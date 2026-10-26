const crypto = require("node:crypto")

module.exports = {
  id: "webhooks",
  create(config = {}, emit, context = {}) {
    if (!context.hookRouter) return Promise.reject(new Error("hook router is not available"))
    const responseCode = config.responseCode === undefined ? 200 : Number(config.responseCode)
    if (!Number.isInteger(responseCode) || responseCode < 100 || responseCode > 599) {
      return Promise.reject(new Error("invalid responseCode"))
    }
    const responseBody = config.responseBody === undefined ? "" : String(config.responseBody)
    const secret = crypto.randomBytes(16).toString("hex")

    context.hookRouter.register(secret, ({ req, res, body }) => {
      emit({
        type: "log",
        payload: {
          level: "info",
          message: `${req.method} ${req.url}\n${JSON.stringify(req.headers, null, 2)}`,
        },
      })
      emit({
        type: "data",
        payload: {
          encoding: "base64",
          data: body.toString("base64"),
          bytes: body.length,
          method: req.method,
          url: req.url,
          headers: req.headers,
        },
      })
      res.writeHead(responseCode, { "Content-Type": "text/plain" })
      res.end(responseBody)
    })

    return Promise.resolve({
      ready: { url: `http://127.0.0.1:${context.port}/hook/${secret}` },
      send() {},
      close() {
        context.hookRouter.unregister(secret)
      },
    })
  },
}
