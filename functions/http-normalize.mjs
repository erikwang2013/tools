export function normalizeResponse(raw) {
  if (raw !== null && typeof raw === "object" && raw.data !== undefined) {
    return { status: raw.status, headers: raw.headers || {}, data: raw.data }
  }
  return { status: 200, headers: {}, data: raw }
}
