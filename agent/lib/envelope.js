const MAX_MESSAGE_BYTES = 16 * 1024 * 1024
const TYPES = new Set([
  "auth",
  "open",
  "send",
  "close",
  "auth:ok",
  "auth:fail",
  "ready",
  "log",
  "data",
  "error",
  "closed",
])
const SESSION_TYPES = new Set(["open", "send", "close", "ready", "log", "data", "error", "closed"])

class ProtocolError extends Error {
  constructor(message, code = "PROTOCOL_ERROR") {
    super(message)
    this.code = code
  }
}

function validate(message) {
  if (message === null || typeof message !== "object" || Array.isArray(message)) {
    throw new ProtocolError("invalid message", "INVALID_MESSAGE")
  }
  if (message.v !== 1) throw new ProtocolError("unsupported version", "BAD_VERSION")
  if (!TYPES.has(message.type)) throw new ProtocolError("unknown type", "BAD_TYPE")
  if (SESSION_TYPES.has(message.type) && (typeof message.id !== "string" || message.id === "")) {
    throw new ProtocolError("missing id", "MISSING_ID")
  }
  return message
}

function encode(message) {
  return JSON.stringify(validate(message))
}

function decode(raw, { maxBytes = MAX_MESSAGE_BYTES } = {}) {
  if (typeof raw !== "string" && !Buffer.isBuffer(raw)) {
    throw new ProtocolError("invalid message", "INVALID_MESSAGE")
  }
  if (Buffer.byteLength(raw) > maxBytes) {
    throw new ProtocolError("message too large", "TOO_LARGE")
  }
  let message
  try {
    message = JSON.parse(raw)
  } catch {
    throw new ProtocolError("invalid json", "INVALID_JSON")
  }
  return validate(message)
}

module.exports = { encode, decode, ProtocolError, MAX_MESSAGE_BYTES, TYPES }
