const net = require("node:net")
const { encodeChunk, RtmpChunkDecoder } = require("../lib/rtmp-chunk")
const { commandFrame, decodeAmfSequence, rtmpHandshake } = require("../lib/rtmp")

function parseRtmpUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error("invalid rtmp url")
  }
  if (url.protocol !== "rtmp:") throw new Error("rtmp url required")
  const parts = url.pathname.split("/").filter(Boolean)
  if (parts.length < 2) throw new Error("rtmp url must include app and stream")
  return {
    host: url.hostname,
    port: Number(url.port) || 1935,
    app: parts[0],
    streamName: parts.slice(1).join("/"),
  }
}

module.exports = {
  id: "rtmp",
  create(config = {}, emit) {
    let target
    try {
      target = parseRtmpUrl(config.url)
    } catch (error) {
      return Promise.reject(error)
    }
    const action = config.action === "publish" ? "publish" : "play"
    const socket = net.connect({ host: target.host, port: target.port })
    const decoder = new RtmpChunkDecoder()
    let streamId = 0
    let ready = false
    let closed = false

    const sendCommand = values => {
      if (!socket.writable) return
      socket.write(commandFrame(values))
    }

    const handleCommand = message => {
      let values
      try {
        values = decodeAmfSequence(message.payload)
      } catch {
        return
      }
      const name = values[0]
      const transactionId = values[1]
      emit({
        type: "log",
        payload: { level: "info", message: `RTMP ${name} ${JSON.stringify(values.slice(2))}` },
      })
      if (name === "_result" && transactionId === 1) {
        sendCommand(["createStream", 2, null])
      } else if (name === "_result" && transactionId === 2) {
        const id = values.slice(2).find(value => typeof value === "number") || 1
        streamId = id
        if (action === "play") sendCommand(["play", 0, null, target.streamName])
        else sendCommand(["publish", 0, null, target.streamName, "live"])
      } else if (name === "onStatus") {
        const info = values[3] || {}
        emit({ type: "log", payload: { level: "info", message: `RTMP status: ${info.code || ""}` } })
      }
    }

    const handleMessages = messages => {
      for (const message of messages) {
        if (message.typeId === 1 && message.payload.length >= 4) {
          decoder.chunkSize = message.payload.readUInt32BE(0) & 0x7fffffff
          emit({ type: "log", payload: { level: "info", message: `RTMP chunk size ${decoder.chunkSize}` } })
        } else if (message.typeId === 20) {
          handleCommand(message)
        } else if (message.typeId === 8 || message.typeId === 9) {
          const preview = message.payload.subarray(0, 4096)
          emit({
            type: "log",
            payload: {
              level: "info",
              message: `RTMP ${message.typeId === 8 ? "audio" : "video"} ${message.payload.length} bytes${
                message.payload.length > preview.length ? " (truncated)" : ""
              }`,
            },
          })
          emit({
            type: "data",
            payload: {
              encoding: "base64",
              data: preview.toString("base64"),
              bytes: message.payload.length,
            },
          })
        }
      }
    }

    socket.on("data", chunk => {
      // Handshake bytes are consumed by rtmpHandshake(); decode only RTMP chunks.
      if (!ready) return
      try {
        handleMessages(decoder.push(chunk))
      } catch (error) {
        emit({ type: "error", payload: { message: error.message } })
      }
    })
    socket.on("error", error => emit({ type: "error", payload: { message: error.message } }))
    socket.on("close", () => {
      if (closed) return
      closed = true
      emit({ type: "closed", payload: { reason: "socket closed" } })
    })

    return (async () => {
      await new Promise((resolve, reject) => {
        socket.once("connect", resolve)
        socket.once("error", reject)
      })
      let leftover
      try {
        ;({ leftover } = await rtmpHandshake(socket))
      } catch (error) {
        socket.destroy()
        throw error
      }
      if (leftover.length) handleMessages(decoder.push(leftover))
      sendCommand([
        "connect",
        1,
        {
          app: target.app,
          type: "nonprivate",
          flashVer: "FMLE/3.0",
          tcUrl: `rtmp://${target.host}:${target.port}/${target.app}`,
        },
      ])
      ready = true
      return {
        ready: { app: target.app, streamName: target.streamName },
        send(payload) {
          if (!ready || closed) throw new Error("session closed")
          if (action !== "publish") {
            emit({ type: "log", payload: { level: "info", message: "play mode ignores send" } })
            return
          }
          if (!streamId) throw new Error("stream is not ready")
          const typeId = config.mediaType === "audio" ? 8 : 9
          const body = payload.encoding === "base64" ? Buffer.from(payload.data, "base64") : Buffer.from(payload.data)
          socket.write(
            encodeChunk({
              csid: config.mediaType === "audio" ? 4 : 6,
              typeId,
              streamId,
              timestamp: Date.now() & 0xffffff,
              payload: body,
            })
          )
        },
        close() {
          if (closed) return
          if (streamId) {
            try {
              sendCommand(["deleteStream", 0, null, streamId])
            } catch {}
          }
          closed = true
          socket.destroy()
        },
      }
    })()
  },
}
