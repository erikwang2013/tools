const DEFAULT_TIMEOUT_MS = 30000

let counter = 0

// Node 18 has no global CustomEvent, so carry the detail on a plain Event.
class DetailEvent extends Event {
  constructor(type, detail) {
    super(type)
    this.detail = detail
  }
}

export class AgentClient extends EventTarget {
  constructor({ WebSocketImpl = globalThis.WebSocket, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    super()
    this._WebSocketImpl = WebSocketImpl
    this._timeoutMs = timeoutMs
    this._ws = null
    this._status = "disconnected"
    this._auth = null
    this._pending = new Map()
    this._sessions = new Set()
  }

  get status() {
    return this._status
  }

  async connect(url, token) {
    this.disconnect()
    if (typeof this._WebSocketImpl !== "function") {
      this._setStatus("error", "WebSocket is not available")
      throw new Error("WebSocket is not available")
    }
    let ws
    try {
      ws = new this._WebSocketImpl(url)
    } catch (error) {
      this._setStatus("error", error.message)
      throw error
    }
    this._ws = ws
    this._setStatus("connecting")
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this._settleAuth(new Error("agent connection timed out")),
        this._timeoutMs
      )
      this._auth = { resolve, reject, timer }
      ws.onopen = () => {
        if (this._ws !== ws) return
        try {
          this._send({ v: 1, type: "auth", token })
        } catch (error) {
          this._settleAuth(error)
        }
      }
      ws.onmessage = event => {
        if (this._ws !== ws) return // frames from a superseded socket
        this._handleMessage(event.data)
      }
      ws.onerror = () => this._drop(ws, new Error("agent connection error"))
      ws.onclose = () => this._drop(ws, new Error("agent connection closed"))
    })
  }

  disconnect() {
    const ws = this._ws
    this._ws = null
    this._rejectAll(new Error("agent disconnected"))
    if (ws) {
      try {
        ws.close()
      } catch {}
    }
    this._setStatus("disconnected")
  }

  async open(protocol, config) {
    if (this._status !== "connected") throw new Error("agent not connected")
    const id = `${Date.now().toString(36)}-${counter++}`
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(id)
        // Tell the agent to release the slot if its `ready` lost the race with this timer.
        try {
          this._send({ v: 1, type: "close", id })
        } catch {}
        reject(new Error(`session open timed out: ${id}`))
      }, this._timeoutMs)
      this._pending.set(id, { resolve, reject, timer })
      try {
        this._send({ v: 1, type: "open", id, protocol, config })
      } catch (error) {
        clearTimeout(timer)
        this._pending.delete(id)
        reject(error)
      }
    })
  }

  async send(sessionId, payload) {
    if (!this._sessions.has(sessionId)) throw new Error(`unknown session: ${sessionId}`)
    this._send({ v: 1, type: "send", id: sessionId, payload })
  }

  async close(sessionId) {
    if (!this._sessions.has(sessionId)) throw new Error(`unknown session: ${sessionId}`)
    this._send({ v: 1, type: "close", id: sessionId })
  }

  _handleMessage(raw) {
    let message
    try {
      message = JSON.parse(raw)
    } catch {
      return
    }
    switch (message.type) {
      case "auth:ok":
        this._settleAuth(null)
        break
      case "auth:fail":
        this._settleAuth(new Error(message.error || "authentication failed"))
        break
      case "ready": {
        const pending = this._takePending(message.id)
        if (!pending) break
        this._sessions.add(message.id)
        pending.resolve({ sessionId: message.id, payload: message.payload || {} })
        break
      }
      case "error": {
        const pending = this._takePending(message.id)
        if (pending) {
          const payload = message.payload || {}
          const error = new Error(payload.message || "session error")
          if (payload.code) error.code = payload.code
          pending.reject(error)
        }
        this._emitSession(message)
        break
      }
      case "closed": {
        this._sessions.delete(message.id)
        const pending = this._takePending(message.id)
        if (pending) pending.reject(new Error(`session closed: ${message.id}`))
        this._emitSession(message)
        break
      }
      case "log":
      case "data":
        this._emitSession(message)
        break
    }
  }

  _settleAuth(error) {
    const auth = this._auth
    if (!auth) return
    this._auth = null
    clearTimeout(auth.timer)
    if (!error) {
      this._setStatus("connected")
      auth.resolve()
      return
    }
    this._setStatus("error", error.message)
    auth.reject(error)
    if (this._ws) {
      try {
        this._ws.close()
      } catch {}
    }
  }

  _drop(ws, error) {
    if (ws !== this._ws) return
    this._ws = null
    this._rejectAll(error)
    this._setStatus("disconnected")
  }

  _takePending(id) {
    const pending = this._pending.get(id)
    if (!pending) return null
    this._pending.delete(id)
    clearTimeout(pending.timer)
    return pending
  }

  _rejectAll(error) {
    const auth = this._auth
    this._auth = null
    if (auth) {
      clearTimeout(auth.timer)
      auth.reject(error)
    }
    for (const pending of this._pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this._pending.clear()
    this._sessions.clear()
  }

  _emitSession(message) {
    this.dispatchEvent(
      new DetailEvent("session", {
        sessionId: message.id,
        type: message.type,
        payload: message.payload || {},
      })
    )
  }

  _setStatus(status, error) {
    if (this._status === status && error === undefined) return
    this._status = status
    this.dispatchEvent(
      new DetailEvent("status", error === undefined ? { status } : { status, error })
    )
  }

  _send(message) {
    if (!this._ws) throw new Error("agent not connected")
    this._ws.send(JSON.stringify(message))
  }
}

export const agentClient = new AgentClient()
