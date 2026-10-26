const dgram = require("node:dgram")
const {
  buildReadProperty,
  buildWhoIs,
  buildWriteProperty,
  parseApdu,
  parseBvlc,
} = require("../lib/bacnet")

module.exports = {
  id: "bacnet-ip",
  create(config = {}, emit) {
    const target = config.target || "127.0.0.1"
    const port = Number(config.port || 47808)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    const action = config.action || "whoIs"
    if (!["whoIs", "readProperty", "writeProperty"].includes(action)) {
      return Promise.reject(new Error("unsupported action"))
    }
    if (action !== "whoIs") {
      if (config.instance === undefined || config.instance === "") {
        return Promise.reject(new Error("instance is required"))
      }
      if (config.property === undefined || config.property === "") {
        return Promise.reject(new Error("property is required"))
      }
    }
    const socket = dgram.createSocket("udp4")
    let timer
    let closed = false

    socket.on("message", message => {
      try {
        const bvlc = parseBvlc(message)
        if (!bvlc) return
        const apdu = parseApdu(bvlc.npdu)
        if (!apdu) return
        clearTimeout(timer)
        if (apdu.type === "i-am") {
          emit({
            type: "data",
            payload: {
              encoding: "utf8",
              data: JSON.stringify({ deviceId: apdu.objectId, vendorId: apdu.vendorId }),
            },
          })
          return
        }
        if (apdu.type === "complex-ack") {
          emit({
            type: "data",
            payload: {
              encoding: "utf8",
              data: JSON.stringify({
                objectId: apdu.objectId,
                property: apdu.property,
                values: apdu.values,
              }),
            },
          })
          return
        }
        if (apdu.type === "error" || apdu.type === "reject" || apdu.type === "abort") {
          emit({ type: "error", payload: { message: `BACnet ${apdu.type}` } })
        }
      } catch (error) {
        emit({ type: "error", payload: { message: error.message } })
      }
    })
    socket.on("error", error => emit({ type: "error", payload: { message: error.message } }))

    return new Promise((resolve, reject) => {
      socket.bind(0, "0.0.0.0", () => {
        resolve({
          ready: { target, port },
          send() {
            if (closed) throw new Error("session closed")
            let frame
            if (action === "whoIs") frame = buildWhoIs()
            else if (action === "readProperty") {
              frame = buildReadProperty({
                type: Number(config.objectType || 0),
                instance: Number(config.instance),
                property: Number(config.property),
              })
            } else {
              frame = buildWriteProperty({
                type: Number(config.objectType || 0),
                instance: Number(config.instance),
                property: Number(config.property),
                value: config.value,
              })
            }
            socket.send(frame, port, target)
            clearTimeout(timer)
            timer = setTimeout(
              () => emit({ type: "error", payload: { message: "BACnet response timed out" } }),
              5000
            )
          },
          close() {
            if (closed) return
            closed = true
            clearTimeout(timer)
            socket.close()
          },
        })
      })
      socket.once("error", reject)
    })
  },
}
