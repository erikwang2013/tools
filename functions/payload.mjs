import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  hexToBytes,
  isBase64,
  isHex,
  utf8ToBytes,
} from "./bytes.mjs"

export const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024

function checkSize(byteLength) {
  if (byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error(`payload too large: ${byteLength} bytes (max ${MAX_PAYLOAD_BYTES})`)
  }
}

function base64ByteLength(base64) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return (base64.length / 4) * 3 - padding
}

export function editorToWire({ mode, text, base64 } = {}) {
  switch (mode) {
    case "none":
      return null
    case "text":
    case "json":
    case "xml": {
      const data = text ?? ""
      checkSize(utf8ToBytes(data).length)
      return { encoding: "utf8", data }
    }
    case "hex": {
      const hex = text ?? ""
      if (!isHex(hex)) throw new Error("invalid hex")
      checkSize(hex.length / 2)
      return { encoding: "base64", data: bytesToBase64(hexToBytes(hex)) }
    }
    case "base64":
    case "file": {
      if (!isBase64(base64)) throw new Error("invalid base64")
      checkSize(base64ByteLength(base64))
      return { encoding: "base64", data: base64 }
    }
    default:
      throw new Error(`unknown payload mode: ${mode}`)
  }
}

export function wireToEditor(payload) {
  if (!payload) return { mode: "none", text: "", base64: "" }
  if (payload.encoding === "utf8") {
    return { mode: "text", text: payload.data ?? "", base64: "" }
  }
  if (payload.encoding === "base64") {
    return { mode: "hex", text: bytesToHex(base64ToBytes(payload.data)), base64: payload.data }
  }
  throw new Error(`unsupported encoding: ${payload.encoding}`)
}
