const net = require("node:net")
const {
  U,
  FeedParser,
  encodeApdu,
  encodeInterrogation,
  encodeRead,
  encodeUFrame,
  parseAsdu,
} = require("../lib/iec104")

module.exports = {
  id: "iec104",
  create(config = {}, emit) {
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    const commonAddress = Number(config.commonAddress || 1)
    if (!Number.isInteger(commonAddress) || commonAddress < 1 || commonAddress > 65535) {
      return Promise.reject(new Error("invalid commonAddress"))
    }
    const socket = net.connect({ host: config.host, port })
    const parser = new FeedParser()
    let sendSeq = 0
    let recvSeq = 0
    let ready = false
    let closed = false
    let resolveReady
    let rejectReady
    const readyPromise = new Promise((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })

    const write = buffer => {
      if (socket.writable) socket.write(buffer)
    }

    const acknowledge = () => write(encodeApdu({ type: "S", recvSeq }))

    const handle = frame => {
      if (frame.type === "U") {
        if (frame.code === U.STARTDT_CON) {
          ready = true
          resolveReady()
        } else if (frame.code === U.TESTFR_ACT) {
          write(encodeUFrame(U.TESTFR_CON))
        }
        return
      }
      if (frame.type === "I") {
        recvSeq = (frame.sendSeq + 1) & 0x7fff
        acknowledge()
        const asdu = parseAsdu(frame.asdu)
        if (!asdu) return
        if (asdu.cause === 3) {
          emit({ type: "log", payload: { level: "info", message: `IEC 104 spontaneous: ${JSON.stringify(asdu)}` } })
        } else {
          emit({ type: "data", payload: { encoding: "utf8", data: JSON.stringify(asdu) } })
        }
      }
    }

    socket.on("data", chunk => {
      try {
        for (const frame of parser.push(chunk)) handle(frame)
      } catch (error) {
        emit({ type: "error", payload: { message: error.message } })
      }
    })
    socket.on("error", error => {
      if (!ready) rejectReady(error)
      emit({ type: "error", payload: { message: error.message } })
    })
    socket.on("close", () => {
      if (!ready) rejectReady(new Error("IEC 104 connection closed"))
      if (closed) return
      closed = true
      emit({ type: "closed", payload: { reason: "socket closed" } })
    })

    const timer = setTimeout(() => {
      if (!ready) rejectReady(new Error("IEC 104 connect timed out"))
      socket.destroy()
    }, 30000)

    socket.once("connect", () => write(encodeUFrame(U.STARTDT_ACT)))

    return readyPromise
      .then(() => {
        clearTimeout(timer)
        return {
          ready: { commonAddress },
          send() {
            if (closed) throw new Error("session closed")
            const action = config.action || "interrogation"
            if (action === "startdt") {
              write(encodeUFrame(U.STARTDT_ACT))
              return
            }
            if (action === "read") {
              write(
                encodeApdu({
                  type: "I",
                  sendSeq,
                  recvSeq,
                  asdu: encodeRead({ commonAddress, ioa: Number(config.ioa) || 0 }).subarray(6),
                })
              )
            } else {
              write(
                encodeApdu({
                  type: "I",
                  sendSeq,
                  recvSeq,
                  asdu: encodeInterrogation({ commonAddress }).subarray(6),
                })
              )
            }
            sendSeq = (sendSeq + 1) & 0x7fff
          },
          close() {
            if (closed) return
            closed = true
            clearTimeout(timer)
            write(encodeUFrame(U.STOPDT_ACT))
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
