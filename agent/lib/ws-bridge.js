const crypto = require("node:crypto")
const WebSocket = require("ws")
const { WebSocketServer } = WebSocket
const { isAllowedOrigin } = require("./origin")
const { MAX_MESSAGE_BYTES } = require("./envelope")

function createBridgeRegistry({ getPort, origins = [], allowNoOrigin = false } = {}) {
  const bridges = new Map()
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES })

  function closeRecord(record, reason) {
    if (record.closed) return
    record.closed = true
    bridges.delete(record.secret)
    try {
      if (record.browser) record.browser.close()
    } catch {}
    try {
      if (record.upstream) record.upstream.close()
    } catch {}
    if (typeof record.onClose === "function") record.onClose(reason)
  }

  async function register(config = {}) {
    let target
    try {
      target = new URL(config.targetUrl)
    } catch {
      throw new Error("invalid targetUrl")
    }
    if (target.protocol !== "ws:" && target.protocol !== "wss:") {
      throw new Error("targetUrl must be ws:// or wss://")
    }
    const secret = crypto.randomBytes(16).toString("hex")
    const upstream = new WebSocket(config.targetUrl, config.subprotocols || [], {
      headers: config.headers || {},
      rejectUnauthorized: !config.allowSelfSigned,
      maxPayload: MAX_MESSAGE_BYTES,
    })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        upstream.terminate()
        reject(new Error("upstream websocket timed out"))
      }, 30000)
      upstream.once("open", () => {
        clearTimeout(timer)
        resolve()
      })
      upstream.once("error", error => {
        clearTimeout(timer)
        reject(error)
      })
    })

    const record = { secret, upstream, browser: null, closed: false, onClose: config.onClose }
    bridges.set(secret, record)
    upstream.on("close", () => closeRecord(record, "upstream closed"))
    upstream.on("error", () => closeRecord(record, "upstream error"))
    return { secret, url: `ws://127.0.0.1:${getPort()}/bridge/${secret}` }
  }

  function unregister(secret) {
    const record = bridges.get(secret)
    if (record) closeRecord(record, "closed by client")
  }

  function handleUpgrade(req, socket, head) {
    const match = /^\/bridge\/([A-Za-z0-9]+)$/.exec(req.url || "")
    if (!match) return false
    const origin = req.headers.origin
    const allowed = origin === undefined ? allowNoOrigin : isAllowedOrigin(origin, origins)
    if (!allowed) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n")
      socket.destroy()
      return true
    }
    const record = bridges.get(match[1])
    if (!record || record.closed) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n")
      socket.destroy()
      return true
    }
    wss.handleUpgrade(req, socket, head, browser => {
      record.browser = browser
      browser.on("message", (data, isBinary) => {
        if (record.upstream.readyState === WebSocket.OPEN) {
          record.upstream.send(data, { binary: isBinary })
        }
      })
      record.upstream.on("message", (data, isBinary) => {
        if (browser.readyState === WebSocket.OPEN) browser.send(data, { binary: isBinary })
      })
      browser.on("close", () => closeRecord(record, "browser closed"))
      browser.on("error", () => closeRecord(record, "browser error"))
    })
    return true
  }

  function closeAll() {
    for (const record of [...bridges.values()]) closeRecord(record, "agent stopped")
    wss.close()
  }

  return { register, unregister, handleUpgrade, closeAll }
}

module.exports = { createBridgeRegistry }
