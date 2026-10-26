const net = require("node:net")
const { FeedParser, encodeFrame } = require("../lib/stomp")

module.exports = {
  id: "stomp-tcp",
  create(config = {}, emit) {
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    const socket = net.connect({ host: config.host, port })
    const parser = new FeedParser()
    let connected = false
    let closed = false
    let resolveReady
    let rejectReady
    const ready = new Promise((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })

    const writeFrame = frame => {
      if (!socket.writable) throw new Error("socket not writable")
      socket.write(encodeFrame(frame))
    }

    const handle = frame => {
      if (frame.command === "CONNECTED") {
        connected = true
        resolveReady()
        if (config.subscribeDestination) {
          writeFrame({
            command: "SUBSCRIBE",
            headers: { destination: config.subscribeDestination, id: "0", ack: "auto" },
          })
        }
        return
      }
      if (frame.command === "MESSAGE") {
        emit({
          type: "data",
          payload: {
            encoding: "base64",
            data: frame.body.toString("base64"),
            bytes: frame.body.length,
            remote: frame.headers.destination,
          },
        })
        return
      }
      if (frame.command === "ERROR") {
        emit({
          type: "error",
          payload: { message: frame.headers.message || frame.body.toString("utf8") },
        })
        emit({ type: "closed", payload: { reason: "STOMP error" } })
        socket.destroy()
      }
    }

    socket.once("connect", () => {
      const headers = {
        "accept-version": "1.2",
        host: config.host,
        ...(config.login ? { login: config.login } : {}),
        ...(config.passcode ? { passcode: config.passcode } : {}),
        ...(config.connectHeaders || {}),
      }
      socket.write(encodeFrame({ command: "CONNECT", headers }))
    })

    socket.on("data", chunk => {
      try {
        for (const frame of parser.push(chunk)) handle(frame)
      } catch (error) {
        emit({ type: "error", payload: { message: error.message } })
      }
    })
    socket.on("error", error => {
      if (!connected) rejectReady(error)
      emit({ type: "error", payload: { message: error.message } })
    })
    socket.on("close", () => {
      if (!connected) rejectReady(new Error("STOMP connection closed"))
      if (closed) return
      closed = true
      emit({ type: "closed", payload: { reason: "socket closed" } })
    })

    const timer = setTimeout(() => {
      if (!connected) rejectReady(new Error("STOMP connect timed out"))
      socket.destroy()
    }, 30000)

    return ready
      .then(() => {
        clearTimeout(timer)
        return {
          ready: { connected: true },
          send(payload) {
            if (closed || !connected) throw new Error("session closed")
            const body =
              payload && payload.encoding === "base64"
                ? Buffer.from(payload.data, "base64")
                : Buffer.from(payload ? payload.data || "" : "")
            writeFrame({
              command: "SEND",
              headers: { destination: config.sendDestination || "" },
              body,
            })
          },
          close() {
            if (closed) return
            closed = true
            clearTimeout(timer)
            try {
              writeFrame({ command: "DISCONNECT" })
            } catch {}
            socket.destroy()
          },
        }
      })
      .catch(error => {
        clearTimeout(timer)
        socket.destroy()
        throw error
      })
  },
}
