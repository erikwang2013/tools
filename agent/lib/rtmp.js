const crypto = require("node:crypto")
const { decodeAmf0, encodeAmf0 } = require("./amf0")
const { encodeChunk } = require("./rtmp-chunk")

function rtmpHandshake(socket) {
  return new Promise((resolve, reject) => {
    const c1 = Buffer.alloc(1536)
    c1.writeUInt32BE(0, 0)
    crypto.randomFillSync(c1, 8)
    socket.write(Buffer.concat([Buffer.from([3]), c1]))

    let buffer = Buffer.alloc(0)
    const timer = setTimeout(() => {
      socket.off("data", onData)
      reject(new Error("RTMP handshake failed: timeout"))
    }, 10000)
    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk])
      if (buffer.length < 3073) return
      clearTimeout(timer)
      socket.off("data", onData)
      const s0 = buffer[0]
      const s1 = buffer.subarray(1, 1537)
      const s2 = buffer.subarray(1537, 3073)
      if (s0 !== 3) return reject(new Error("RTMP handshake failed: unsupported version"))
      if (s2.readUInt32BE(0) !== c1.readUInt32BE(0)) {
        return reject(new Error("RTMP handshake failed: bad S2 echo"))
      }
      socket.write(s1)
      resolve({ leftover: buffer.subarray(3073) })
    }
    socket.on("data", onData)
    socket.once("error", reject)
  })
}

function decodeAmfSequence(buffer) {
  const values = []
  let offset = 0
  while (offset < buffer.length) {
    const item = decodeAmf0(buffer, offset)
    values.push(item.value)
    offset += item.consumed
  }
  return values
}

function commandFrame(values) {
  return encodeChunk({
    csid: 3,
    typeId: 20,
    streamId: 0,
    payload: Buffer.concat(values.map(encodeAmf0)),
  })
}

module.exports = { rtmpHandshake, decodeAmfSequence, commandFrame }
