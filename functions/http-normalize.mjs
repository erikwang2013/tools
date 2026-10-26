export function normalizeResponse(raw) {
  if (raw !== null && typeof raw === "object" && raw.data !== undefined) {
    return { status: raw.status, headers: raw.headers || {}, data: raw.data }
  }
  return { status: 200, headers: {}, data: raw }
}

export function describeBinaryResponse(data, { responseType, viaProxy = false } = {}) {
  if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) return { ok: true }
  if (responseType === "arraybuffer") {
    return {
      ok: false,
      message: viaProxy
        ? "Background proxy or extension returned text; binary responses are unavailable through it. Disable the proxy/extension and retry."
        : "The response is not binary data; check the request body and response headers.",
    }
  }
  return { ok: true }
}
