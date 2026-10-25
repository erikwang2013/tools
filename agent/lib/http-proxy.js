const crypto = require("node:crypto")
const { Readable } = require("node:stream")
const { isAllowedOrigin } = require("./origin")
const { fetchUpstream, readCapped, MAX_RESPONSE_BYTES } = require("./fetch-upstream")

const MAX_REQUEST_BYTES = 16 * 1024 * 1024

function sameToken(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string") return false
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function isTextual(contentType) {
  return /^(text\/|application\/(json|xml|javascript|x-www-form-urlencoded)|[^;]*\+(json|xml))/i.test(
    contentType || ""
  )
}

function corsHeaders(origin) {
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "content-type,x-agent-token",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        Vary: "Origin",
      }
    : {}
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on("data", chunk => {
      total += chunk.length
      if (total > MAX_REQUEST_BYTES) {
        reject(Object.assign(new Error("request body too large"), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks, total).toString("utf8")))
    req.on("error", reject)
  })
}

function sendJson(res, status, body, extraHeaders = {}) {
  const raw = JSON.stringify(body)
  res.writeHead(status, { "Content-Type": "application/json", ...extraHeaders })
  res.end(raw)
}

function createHttpProxy({ token, origins = [], allowNoOrigin = false, fetchImpl = fetchUpstream }) {
  return async function handleHttpProxy(req, res) {
    const origin = req.headers.origin
    const allowed = origin === undefined ? allowNoOrigin : isAllowedOrigin(origin, origins)
    if (!allowed) return sendJson(res, 403, { error: "origin not allowed" })
    const cors = corsHeaders(origin)
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors)
      res.end()
      return
    }
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" }, cors)
    if (!sameToken(req.headers["x-agent-token"], token)) {
      return sendJson(res, 401, { error: "invalid token" }, cors)
    }

    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch (err) {
      return sendJson(res, err.status || 400, { error: err.message }, cors)
    }
    if (body === null || typeof body !== "object") {
      return sendJson(res, 400, { error: "invalid request body" }, cors)
    }

    let upstream
    try {
      upstream = await fetchImpl({
        method: body.method || "GET",
        url: body.url,
        headers: body.headers || {},
        body:
          body.data === undefined
            ? undefined
            : body.encoding === "base64"
              ? Buffer.from(body.data, "base64")
              : body.data,
      })
    } catch (err) {
      return sendJson(res, 502, { error: err.message }, cors)
    }

    const upstreamHeaders = Object.fromEntries(upstream.headers)
    const contentType = upstream.headers.get("content-type") || ""
    if (contentType.includes("text/event-stream")) {
      res.writeHead(upstream.status, { ...upstreamHeaders, ...cors })
      if (upstream.body) Readable.fromWeb(upstream.body).pipe(res)
      else res.end()
      return
    }

    try {
      const buffer = await readCapped(upstream)
      const encoding = isTextual(contentType) ? "utf8" : "base64"
      delete upstreamHeaders["content-encoding"]
      delete upstreamHeaders["content-length"]
      delete upstreamHeaders["transfer-encoding"]
      sendJson(
        res,
        200,
        {
          status: upstream.status,
          headers: upstreamHeaders,
          data: buffer.toString(encoding),
          encoding,
          bytes: buffer.length,
        },
        cors
      )
    } catch (err) {
      sendJson(res, 502, { error: err.message }, cors)
    }
  }
}

module.exports = { createHttpProxy, MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES }
