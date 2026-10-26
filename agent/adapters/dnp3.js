const net = require("node:net")
const {
  buildDirectOperate,
  buildLinkFrame,
  buildReadRequest,
  parseApplication,
  parseLinkFrame,
} = require("../lib/dnp3")

module.exports = {
  id: "dnp3",
  create(config = {}, emit) {
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    const masterAddress = Number(config.masterAddress || 1)
    const outstationAddress = Number(config.outstationAddress || 10)
    if (!Number.isInteger(masterAddress) || masterAddress < 0 || masterAddress > 65519) {
      return Promise.reject(new Error("invalid masterAddress"))
    }
    if (!Number.isInteger(outstationAddress) || outstationAddress < 0 || outstationAddress > 65519) {
      return Promise.reject(new Error("invalid outstationAddress"))
    }
    const socket = net.connect({ host: config.host, port })
    let buffer = Buffer.alloc(0)
    let closed = false
    let timer

    const sendFrame = userData => {
      socket.write(
        buildLinkFrame({
          source: masterAddress,
          destination: outstationAddress,
          direction: "master",
          userData,
        })
      )
      clearTimeout(timer)
      timer = setTimeout(
        () => emit({ type: "error", payload: { message: "DNP3 response timed out" } }),
        Number(config.timeoutMs) || 30000
      )
    }

    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk])
      for (;;) {
        let frame
        try {
          frame = parseLinkFrame(buffer)
        } catch (error) {
          emit({ type: "error", payload: { message: error.message } })
          buffer = Buffer.alloc(0)
          break
        }
        if (!frame) break
        buffer = buffer.subarray(frame.consumed)
        clearTimeout(timer)
        const app = parseApplication(frame.userData)
        emit({
          type: "data",
          payload: {
            encoding: "base64",
            data: frame.userData.toString("base64"),
            bytes: frame.userData.length,
            remote: `${frame.source}`,
          },
        })
        emit({
          type: "log",
          payload: {
            level: "info",
            message: `DNP3 app ${JSON.stringify({ functionCode: app && app.functionCode, objects: app && app.objects })}`,
          },
        })
      }
    })
    socket.on("error", error => emit({ type: "error", payload: { message: error.message } }))
    socket.on("close", () => {
      clearTimeout(timer)
      if (closed) return
      closed = true
      emit({ type: "closed", payload: { reason: "socket closed" } })
    })

    return new Promise((resolve, reject) => {
      socket.once("connect", () => {
        resolve({
          ready: { masterAddress, outstationAddress },
          send() {
            if (closed) throw new Error("session closed")
            const action = config.action || "integrityPoll"
            if (action === "operate") {
              sendFrame(buildDirectOperate({ index: Number(config.index) || 0, value: Number(config.value) || 0 }))
            } else {
              sendFrame(buildReadRequest({ variation: action === "readClass0" ? 2 : 1 }))
            }
          },
          close() {
            if (closed) return
            closed = true
            clearTimeout(timer)
            socket.destroy()
          },
        })
      })
      socket.once("error", reject)
    })
  },
}
