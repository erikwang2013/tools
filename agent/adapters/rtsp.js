const net = require("node:net")
const { fromBuffer } = require("../lib/payload")
const {
  buildRtspRequest,
  digestAuthorization,
  parseDigestChallenge,
  parseRtspResponse,
} = require("../lib/rtsp")

module.exports = {
  id: "rtsp",
  create(config = {}, emit) {
    let url
    try {
      url = new URL(config.url)
    } catch {
      return Promise.reject(new Error("invalid rtsp url"))
    }
    if (url.protocol !== "rtsp:") return Promise.reject(new Error("rtsp url required"))
    const port = Number(url.port) || 554
    const uri = url.toString()
    const socket = net.connect({ host: url.hostname, port })
    let cseq = 1
    let buffer = Buffer.alloc(0)
    let closed = false
    let authRetried = false

    const sendRequest = method => {
      const request = buildRtspRequest({ method, uri, cseq: cseq++, headers: { Accept: "application/sdp" } })
      socket.write(request)
    }

    const handleResponse = response => {
      if (response.interleaved) {
        emit({
          type: "log",
          payload: {
            level: "info",
            message: `RTSP interleaved channel ${response.interleaved.channel}`,
          },
        })
        emit({ type: "data", payload: fromBuffer(response.interleaved.data, { encoding: "base64" }) })
        return
      }
      emit({
        type: "log",
        payload: { level: response.status >= 400 ? "error" : "info", message: `RTSP ${response.status}` },
      })
      if (response.body) {
        emit({ type: "data", payload: fromBuffer(Buffer.from(response.body, "utf8"), { encoding: "utf8" }) })
      }
      if (response.status === 401 && !authRetried && config.username) {
        const challenge = parseDigestChallenge(
          response.headers["WWW-Authenticate"] || response.headers["www-authenticate"]
        )
        if (challenge && challenge.realm && challenge.nonce) {
          authRetried = true
          const authorization = digestAuthorization({
            username: config.username,
            password: config.password || "",
            realm: challenge.realm,
            nonce: challenge.nonce,
            method: config.method || "DESCRIBE",
            uri,
            qop: challenge.qop === "auth" ? "auth" : undefined,
          })
          socket.write(
            buildRtspRequest({
              method: config.method || "DESCRIBE",
              uri,
              cseq: cseq++,
              headers: { Accept: "application/sdp", Authorization: authorization },
            })
          )
        }
      }
    }

    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk])
      for (;;) {
        const response = parseRtspResponse(buffer)
        if (!response.consumed) break
        buffer = buffer.subarray(response.consumed)
        handleResponse(response)
      }
    })
    socket.on("error", error => emit({ type: "error", payload: { message: error.message } }))
    socket.on("close", () => {
      if (closed) return
      closed = true
      emit({ type: "closed", payload: { reason: "socket closed" } })
    })

    return new Promise((resolve, reject) => {
      socket.once("connect", () => {
        sendRequest("OPTIONS")
        resolve({
          ready: { protocol: "rtsp" },
          send() {
            if (closed) throw new Error("socket closed")
            sendRequest(config.method || "DESCRIBE")
          },
          close() {
            if (closed) return
            closed = true
            socket.destroy()
          },
        })
      })
      socket.once("error", reject)
    })
  },
}
