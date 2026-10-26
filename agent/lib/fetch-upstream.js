const MAX_RESPONSE_BYTES = 16 * 1024 * 1024

async function fetchUpstream({ method = "GET", url, headers = {}, body, signal } = {}) {
  if (typeof url !== "string" || url === "") throw new Error("url is required")
  return fetch(url, { method, headers, body, signal, redirect: "follow" })
}

async function readCapped(response, limit = MAX_RESPONSE_BYTES) {
  const chunks = []
  let total = 0
  for await (const chunk of response.body) {
    total += chunk.length
    if (total > limit) throw new Error(`response too large: over ${limit} bytes`)
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks, total)
}

module.exports = { fetchUpstream, readCapped, MAX_RESPONSE_BYTES }
