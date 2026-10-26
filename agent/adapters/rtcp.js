const dgram = require("node:dgram")
const { buildRtcpRr, buildRtcpSdes, parseRtcpPackets } = require("../lib/rtp")

module.exports = {
  id: "rtcp",
  create(config = {}, emit) {
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    const local = config.bindPort === undefined ? 0 : Number(config.bindPort)
    if (!Number.isInteger(local) || local < 0 || local > 65535) {
      return Promise.reject(new Error("invalid bindPort"))
    }
    const socket = dgram.createSocket("udp4")
    let closed = false

    socket.on("message", message => {
      for (const packet of parseRtcpPackets(message)) {
        const extra = packet.type === 200 ? ` packets=${packet.packetCount} octets=${packet.octetCount}` : ""
        emit({
          type: "log",
          payload: { level: "info", message: `RTCP type=${packet.type} ssrc=${packet.ssrc || "-"}${extra}` },
        })
      }
    })
    socket.on("error", error => emit({ type: "error", payload: { message: error.message } }))

    return new Promise((resolve, reject) => {
      socket.bind(local, "127.0.0.1", () => {
        resolve({
          send() {
            if (closed) throw new Error("socket closed")
            const ssrc = 0
            socket.send(buildRtcpRr(ssrc), port, config.host)
            socket.send(buildRtcpSdes(ssrc, config.cname || "postwoman"), port, config.host)
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
