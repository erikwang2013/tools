const crypto = require("node:crypto")

function buildRtspRequest({ method, uri, cseq, headers = {} } = {}) {
  const lines = [`${method} ${uri} RTSP/1.0`, `CSeq: ${cseq}`, "User-Agent: Postwoman-Agent"]
  for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`)
  return lines.join("\r\n") + "\r\n\r\n"
}

function parseRtspResponse(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return { consumed: 0 }
  if (buffer[0] === 0x24) {
    if (buffer.length < 4) return { consumed: 0 }
    const channel = buffer[1]
    const length = buffer.readUInt16BE(2)
    if (buffer.length < 4 + length) return { consumed: 0 }
    return {
      interleaved: { channel, data: buffer.subarray(4, 4 + length) },
      consumed: 4 + length,
    }
  }
  const headerEnd = buffer.indexOf("\r\n\r\n")
  if (headerEnd === -1) return { consumed: 0 }
  const head = buffer.subarray(0, headerEnd).toString("utf8")
  const lines = head.split("\r\n")
  const match = /^RTSP\/\d\.\d\s+(\d{3})/.exec(lines[0])
  if (!match) return { consumed: 0 }
  const headers = {}
  for (const line of lines.slice(1)) {
    const index = line.indexOf(":")
    if (index === -1) continue
    headers[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  const length = Number(headers["Content-Length"] || headers["content-length"] || 0)
  if (buffer.length < headerEnd + 4 + length) return { consumed: 0 }
  return {
    status: Number(match[1]),
    headers,
    body: buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString("utf8"),
    consumed: headerEnd + 4 + length,
  }
}

function md5(value) {
  return crypto.createHash("md5").update(value).digest("hex")
}

function digestAuthorization({ username, password, realm, nonce, method, uri, qop, nc = "00000001", cnonce }) {
  const ha1 = md5(`${username}:${realm}:${password}`)
  const ha2 = md5(`${method}:${uri}`)
  const clientNonce = cnonce || crypto.randomBytes(8).toString("hex")
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${clientNonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`)
  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ]
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${clientNonce}"`)
  return `Digest ${parts.join(", ")}`
}

function parseDigestChallenge(value) {
  if (typeof value !== "string" || !/^Digest\s/i.test(value)) return null
  const result = {}
  for (const match of value.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g)) {
    result[match[1].toLowerCase()] = match[2] !== undefined ? match[2] : match[3]
  }
  return result
}

module.exports = { buildRtspRequest, parseRtspResponse, digestAuthorization, parseDigestChallenge }
