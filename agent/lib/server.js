const http = require("node:http")
const crypto = require("node:crypto")
const WebSocket = require("ws")
const { WebSocketServer } = WebSocket
const { encode, decode, MAX_MESSAGE_BYTES } = require("./envelope")
const { DEFAULT_ORIGINS, isAllowedOrigin } = require("./origin")
const { SessionManager } = require("./session")

const PING_INTERVAL_MS = 30 * 1000

function sameToken(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string") return false
  const a = Buffer.from(actual)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function recoverId(raw) {
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed.id === "string" && parsed.id !== "" ? parsed.id : null
  } catch {
    return null
  }
}

function refuse(socket, status) {
  socket.write(`HTTP/1.1 ${status}\r\n\r\n`)
  socket.destroy()
}

function createAgentServer({
  port = 3567,
  host = "127.0.0.1",
  token = crypto.randomBytes(24).toString("hex"),
  origins = DEFAULT_ORIGINS,
  allowNoOrigin = false,
  adapters = {},
  config = {},
} = {}) {
  if (typeof token !== "string" || token.trim() === "") throw new Error("token must not be empty")
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "not found" }))
  })
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES })

  server.on("upgrade", (req, socket, head) => {
    if (req.url !== "/agent") return refuse(socket, "404 Not Found")
    const origin = req.headers.origin
    const allowed = origin === undefined ? allowNoOrigin : isAllowedOrigin(origin, origins)
    if (!allowed) return refuse(socket, "403 Forbidden")
    wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req))
  })

  wss.on("connection", ws => {
    const manager = new SessionManager({
      adapters,
      emit: (id, event) => send(ws, { v: 1, type: event.type, id, payload: event.payload }),
      context: {
        port: server.address().port,
        hookRouter: null,
        bridgeRegistry: null,
        mcpServers: config.mcpServers || {},
      },
    })
    const state = { authed: false, manager }
    ws.isAlive = true
    ws.on("pong", () => { ws.isAlive = true })
    ws.on("error", () => {})
    ws.on("close", () => manager.closeAll())
    // Session failures are reported over the socket; an unexpected throw only ends this connection.
    ws.on("message", raw => handleMessage(ws, state, raw).catch(() => ws.close(4002)))
  })

  // encode() rejects malformed messages; ws.send throws on a closing socket.
  function send(ws, message) {
    if (ws.readyState !== WebSocket.OPEN) return
    const id = message && typeof message === "object" ? message.id : undefined
    let raw
    try {
      raw = encode(message)
    } catch {
      return sendFailure(ws, id, "invalid outbound message")
    }
    if (Buffer.byteLength(raw) > MAX_MESSAGE_BYTES) {
      return sendFailure(ws, id, "message too large")
    }
    ws.send(raw)
  }

  function sendFailure(ws, id, message) {
    if (typeof id === "string" && id !== "" && ws.readyState === WebSocket.OPEN) {
      const raw = encode({ v: 1, type: "error", id, payload: { message } })
      // The id is client-controlled, so the fallback frame needs the same cap.
      if (Buffer.byteLength(raw) <= MAX_MESSAGE_BYTES) {
        ws.send(raw)
        return
      }
    }
    ws.close(4002)
  }

  async function handleMessage(ws, state, raw) {
    let message
    try {
      message = decode(raw)
    } catch (err) {
      if (!state.authed) {
        ws.close(4002)
        return
      }
      const id = recoverId(raw)
      if (id) send(ws, { v: 1, type: "error", id, payload: { message: err.message, code: err.code } })
      else ws.close(4002)
      return
    }
    if (message.type === "auth") {
      if (!sameToken(message.token, token)) {
        send(ws, { v: 1, type: "auth:fail", error: "invalid token" })
        ws.close(4001)
        return
      }
      state.authed = true
      send(ws, { v: 1, type: "auth:ok" })
      return
    }
    if (!state.authed) {
      ws.close(4002)
      return
    }
    if (message.type === "open" || message.type === "send" || message.type === "close") {
      return handleSession(ws, state, message)
    }
    send(ws, { v: 1, type: "error", id: message.id, payload: { message: `unsupported type: ${message.type}` } })
  }

  async function handleSession(ws, state, message) {
    if (message.type === "open") {
      let ready
      try {
        ({ ready } = await state.manager.open(message.id, message.protocol, message.config))
      } catch {
        // Manager-emitted failure frames: error + closed, or only closed when the client
        // closed the session while it was still opening.
        return
      }
      send(ws, { v: 1, type: "ready", id: message.id, payload: ready })
      return
    }
    try {
      if (message.type === "send") await state.manager.send(message.id, message.payload)
      else if (!state.manager.close(message.id)) throw new Error(`unknown session: ${message.id}`)
    } catch (err) {
      send(ws, { v: 1, type: "error", id: message.id, payload: { message: err.message } })
    }
  }

  let pingTimer
  function pingClients() {
    for (const ws of wss.clients) {
      if (ws.readyState !== WebSocket.OPEN) continue
      if (!ws.isAlive) {
        ws.terminate()
        continue
      }
      ws.isAlive = false
      ws.ping()
    }
  }

  function close() {
    clearInterval(pingTimer)
    for (const ws of wss.clients) ws.terminate()
    wss.close()
    return new Promise(resolve => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  }

  return new Promise((resolve, reject) => {
    const onError = err => reject(err)
    server.once("error", onError)
    server.listen(port, host, () => {
      server.off("error", onError)
      pingTimer = setInterval(pingClients, PING_INTERVAL_MS)
      resolve({ server, wss, token, port: server.address().port, close })
    })
  })
}

module.exports = { createAgentServer }
