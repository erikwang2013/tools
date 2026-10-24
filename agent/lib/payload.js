const ENCODINGS = new Set(["utf8", "base64"])
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

function toBuffer({ encoding, data } = {}) {
  if (!ENCODINGS.has(encoding)) throw new Error("unsupported encoding")
  if (typeof data !== "string") throw new Error("payload data must be a string")
  if (encoding === "base64" && (data.length % 4 !== 0 || !BASE64_RE.test(data))) {
    throw new Error("invalid base64")
  }
  return Buffer.from(data, encoding)
}

function fromBuffer(buf, { encoding = "base64" } = {}) {
  if (!Buffer.isBuffer(buf)) throw new Error("payload must be a Buffer")
  if (!ENCODINGS.has(encoding)) throw new Error("unsupported encoding")
  return { encoding, data: buf.toString(encoding), bytes: buf.length }
}

module.exports = { toBuffer, fromBuffer }
