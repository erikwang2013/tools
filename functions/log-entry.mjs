// Base64 carries 4 characters per 3 bytes, so 5464 chars is ~4096 decoded bytes.
const DATA_CHARS = { base64: 5464, utf8: 4096 }

export function makeLogEntry({ direction, encoding, data, bytes, remote, ts = Date.now() }) {
  const text = data == null ? "" : String(data)
  const entry = { ts, direction, encoding: encoding || "utf8", data: text }
  if (bytes !== undefined && bytes !== null) entry.bytes = bytes
  if (remote) entry.remote = remote
  const limit = DATA_CHARS[entry.encoding] || DATA_CHARS.utf8
  if (text.length > limit) {
    entry.data = text.slice(0, limit)
    entry.truncated = true
    if (entry.bytes === undefined) entry.bytes = text.length
  }
  return entry
}
