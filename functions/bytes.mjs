const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/
const HEX_PAIRS = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, "0"))

export function isHex(value) {
  return typeof value === "string" && value.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(value)
}

export function isBase64(value) {
  return typeof value === "string" && value.length % 4 === 0 && BASE64_RE.test(value)
}

export function hexToBytes(hex) {
  if (!isHex(hex)) throw new Error("invalid hex")
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function bytesToHex(bytes) {
  const chunks = []
  // Chunked: one N-element array of per-byte strings costs ~1.2 GB at the 16 MiB cap.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    chunks.push(Array.from(bytes.subarray(i, i + 0x8000), byte => HEX_PAIRS[byte]).join(""))
  }
  return chunks.join("")
}

export function base64ToBytes(base64) {
  if (!isBase64(base64)) throw new Error("invalid base64")
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function bytesToBase64(bytes) {
  let binary = ""
  // Chunked: spreading a 16 MiB array into fromCharCode would overflow the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export function utf8ToBytes(text) {
  return new TextEncoder().encode(text)
}

export function bytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes)
}

export function toHexDump(bytes, { width = 16, offset = true } = {}) {
  const step = Math.max(1, Math.trunc(width) || 0)
  const lines = []
  for (let i = 0; i < bytes.length; i += step) {
    const hex = Array.from(bytes.subarray(i, i + step), byte => HEX_PAIRS[byte]).join(" ")
    lines.push(offset ? `${i.toString(16).padStart(8, "0")}  ${hex}` : hex)
  }
  return lines.join("\n")
}
