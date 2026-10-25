const { fetchUpstream, readCapped } = require("../lib/fetch-upstream")

function isTextual(contentType) {
  return /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|[^;]*\+(json|xml))/i.test(
    contentType || ""
  )
}

module.exports = {
  id: "http-proxy",
  create(config = {}, emit) {
    if (typeof config.url !== "string" || config.url === "") {
      return Promise.reject(new Error("url is required"))
    }
    const controller = new AbortController()
    return Promise.resolve({
      send(payload) {
        return fetchUpstream({
          method: config.method || "GET",
          url: config.url,
          headers: config.headers || {},
          body: payload ? (payload.encoding === "base64" ? Buffer.from(payload.data, "base64") : payload.data) : undefined,
          signal: controller.signal,
        })
          .then(async response => {
            const buffer = await readCapped(response)
            const contentType = response.headers.get("content-type") || ""
            const encoding = isTextual(contentType) ? "utf8" : "base64"
            emit({
              type: "data",
              payload: {
                status: response.status,
                headers: Object.fromEntries(response.headers),
                encoding,
                data: buffer.toString(encoding),
                bytes: buffer.length,
              },
            })
            emit({ type: "closed", payload: { reason: "response complete" } })
          })
          .catch(err => {
            emit({ type: "error", payload: { message: err.message } })
            emit({ type: "closed", payload: { reason: err.message } })
          })
      },
      close() {
        controller.abort()
      },
    })
  },
}
