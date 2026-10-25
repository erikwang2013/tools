const dgram = require("node:dgram")
const { toBuffer } = require("../lib/payload")
const { buildRtpPacket, parseRtpPacket } = require("../lib/rtp")

function bindPort(config) {
  const value = config.bindPort === undefined ? 0 : Number(config.bindPort)
  if (!Number.isInteger(value) || value < 0 || value > 65535) throw new Error("invalid bindPort")
  return value
}

module.exports = {
  id: "rtp",
  create(config = {}, emit) {
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    let local
    try {
      local = bindPort(config)
    } catch (error) {
      return Promise.reject(error)
    }
    const socket = dgram.createSocket("udp4")
    let sequence = Number.isInteger(Number(config.sequence)) ? Number(config.sequence) : 1
    let timestamp = Number.isInteger(Number(config.timestamp)) ? Number(config.timestamp) : 0
    const payloadType = Number(config.payloadType) || 96
    const clockRate = Number(config.clockRate) || 8000
    const ssrc = Number(config.ssrc) || Math.floor(Math.random() * 0xffffffff)
    let closed = false

    socket.on("message", (message, remote) => {
      try {
        const packet = parseRtpPacket(message)
        emit({
          type: "log",
          payload: {
            level: "info",
            message: `RTP PT=${packet.payloadType} seq=${packet.sequence} ts=${packet.timestamp} ssrc=${packet.ssrc} marker=${packet.marker} from ${remote.address}:${remote.port}`,
          },
        })
        emit({
          type: "data",
          payload: {
            encoding: "base64",
            data: packet.payload.toString("base64"),
            bytes: packet.payload.length,
            remote: `${remote.address}:${remote.port}`,
          },
        })
      } catch (error) {
        emit({
          type: "log",
          payload: {
            level: "warn",
            message: `malformed RTP packet (${error.message}): ${message.toString("hex")}`,
          },
        })
      }
    })
    socket.on("error", error => emit({ type: "error", payload: { message: error.message } }))

    const loopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(config.host)
    return new Promise((resolve, reject) => {
      socket.bind(local, loopback ? "127.0.0.1" : "0.0.0.0", () => {
        resolve({
          ready: { ssrc },
          send(payload) {
            if (closed) throw new Error("socket closed")
            const packet = buildRtpPacket(
              { payloadType, sequence, timestamp, ssrc },
              toBuffer(payload)
            )
            socket.send(packet, port, config.host)
            sequence = (sequence + 1) & 0xffff
            timestamp = (timestamp + Math.round(clockRate / 50)) >>> 0
          },
          close() {
            if (closed) return
            closed = true
            socket.close()
          },
        })
      })
      socket.once("error", reject)
    })
  },
}
