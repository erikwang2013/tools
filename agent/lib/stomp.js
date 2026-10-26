const MAX_BUFFER_BYTES = 16 * 1024 * 1024

function escapeHeader(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/:/g, "\\c")
}

function unescapeHeader(value) {
  return String(value).replace(/\\(.)/g, (_match, char) => {
    if (char === "n") return "\n"
    if (char === "r") return "\r"
    if (char === "c") return ":"
    if (char === "\\") return "\\"
    return char
  })
}

function encodeFrame({ command, headers = {}, body = Buffer.alloc(0) } = {}) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8")
  const lines = [String(command)]
  const allHeaders = { ...headers }
  if (allHeaders["content-length"] === undefined && buffer.length > 0) {
    allHeaders["content-length"] = String(buffer.length)
  }
  for (const [key, value] of Object.entries(allHeaders)) {
    lines.push(`${escapeHeader(key)}:${escapeHeader(value)}`)
  }
  return Buffer.concat([
    Buffer.from(`${lines.join("\n")}\n\n`, "utf8"),
    buffer,
    Buffer.from([0]),
  ])
}

class FeedParser {
  constructor() {
    this.buffer = Buffer.alloc(0)
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk])
    if (this.buffer.length > MAX_BUFFER_BYTES) throw new Error("STOMP buffer limit exceeded")
    const frames = []
    for (;;) {
      while (this.buffer.length && this.buffer[0] === 0x0a) this.buffer = this.buffer.subarray(1)
      if (!this.buffer.length) break
      const headerEnd = this.buffer.indexOf("\n\n")
      if (headerEnd === -1) break
      const head = this.buffer.subarray(0, headerEnd).toString("utf8")
      const lines = head.split("\n")
      const command = lines.shift()
      const headers = {}
      for (const line of lines) {
        const index = line.indexOf(":")
        if (index === -1) continue
        headers[unescapeHeader(line.slice(0, index))] = unescapeHeader(line.slice(index + 1))
      }
      const bodyStart = headerEnd + 2
      let bodyEnd
      let consumed
      if (headers["content-length"] !== undefined) {
        const length = Number(headers["content-length"])
        if (!Number.isInteger(length) || length < 0) throw new Error("invalid content-length")
        bodyEnd = bodyStart + length
        if (this.buffer.length < bodyEnd + 1) break
        if (this.buffer[bodyEnd] !== 0) throw new Error("STOMP frame missing null terminator")
        consumed = bodyEnd + 1
      } else {
        bodyEnd = this.buffer.indexOf(0, bodyStart)
        if (bodyEnd === -1) break
        consumed = bodyEnd + 1
      }
      frames.push({ command, headers, body: this.buffer.subarray(bodyStart, bodyEnd) })
      this.buffer = this.buffer.subarray(consumed)
    }
    return frames
  }
}

module.exports = { encodeFrame, FeedParser, escapeHeader, unescapeHeader }
