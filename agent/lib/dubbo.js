const hessian = require("hessian.js")

const MAGIC = 0xdabb
const FLAG_REQUEST = 0xc2
const STATUS_OK = 20

function encodeDubboRequest({
  requestId = 1,
  interfaceName,
  version = "1.0.0",
  method,
  parameterTypes = [],
  args = [],
} = {}) {
  if (!interfaceName) throw new Error("interface is required")
  if (!method) throw new Error("method is required")
  const encoder = new hessian.EncoderV2()
  encoder.write(["2.0.2", interfaceName, version, method, parameterTypes, ...args])
  const body = encoder.get()
  if (body.length > 16 * 1024 * 1024) throw new Error("Dubbo body too large")
  const header = Buffer.alloc(16)
  header.writeUInt16BE(MAGIC, 0)
  header[2] = FLAG_REQUEST
  header[3] = 0
  header.writeBigInt64BE(BigInt(requestId), 4)
  header.writeUInt32BE(body.length, 12)
  return Buffer.concat([header, body])
}

function decodeDubboResponse(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error("Incomplete Dubbo response")
  if (buffer.readUInt16BE(0) !== MAGIC) throw new Error("Invalid Dubbo magic")
  const status = buffer[3]
  const length = buffer.readUInt32BE(12)
  if (buffer.length < 16 + length) throw new Error("Incomplete Dubbo response")
  const decoder = new hessian.DecoderV2(buffer.subarray(16, 16 + length))
  const decoded = decoder.read()
  let result
  if (Array.isArray(decoded)) result = decoded.length > 1 ? decoded[1] : decoded[0]
  else result = decoded
  return {
    status,
    ok: status === STATUS_OK,
    result: status === STATUS_OK ? result : decoded,
  }
}

function responseFrame({ requestId, status = STATUS_OK, body }) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body || "")
  const header = Buffer.alloc(16)
  header.writeUInt16BE(MAGIC, 0)
  header[2] = 0
  header[3] = status
  header.writeBigInt64BE(BigInt(requestId), 4)
  header.writeUInt32BE(payload.length, 12)
  return Buffer.concat([header, payload])
}

module.exports = { encodeDubboRequest, decodeDubboResponse, responseFrame, STATUS_OK }
