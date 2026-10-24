const DEFAULT_ORIGINS = [
  "https://postwoman.erik.xyz",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]

function isAllowedOrigin(origin, allowlist) {
  return typeof origin === "string" && Array.isArray(allowlist) && allowlist.includes(origin)
}

module.exports = { isAllowedOrigin, DEFAULT_ORIGINS }
