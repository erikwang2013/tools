import { parseSse } from "./sse.mjs"

const PROTOCOL_VERSION = "2024-11-05"

export class McpRemoteClient {
  constructor({ url, headers = {}, fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
    if (!url) throw new Error("MCP url is required")
    this.url = url
    this.headers = { ...headers }
    this.fetchImpl = fetchImpl
    this.timeoutMs = timeoutMs
    this.sessionId = null
    this.nextId = 1
  }

  async initialize() {
    const result = await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "postwoman", version: "1" },
    })
    try {
      await this.notify("notifications/initialized")
    } catch {
      // Some servers close the notification request without a body; that is fine.
    }
    return result
  }

  listTools() {
    return this.request("tools/list").then(result => result.tools || [])
  }

  listResources() {
    return this.request("resources/list").then(result => result.resources || [])
  }

  listPrompts() {
    return this.request("prompts/list").then(result => result.prompts || [])
  }

  callTool(name, args) {
    return this.request("tools/call", { name, arguments: args || {} })
  }

  close() {
    this.sessionId = null
  }

  async notify(method, params) {
    const headers = this.requestHeaders()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      await this.fetchImpl(this.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", method, params: params || {} }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
  }

  requestHeaders() {
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...this.headers,
    }
    if (this.sessionId) headers["mcp-session-id"] = this.sessionId
    return headers
  }

  async request(method, params) {
    const id = this.nextId++
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let response
    try {
      response = await this.fetchImpl(this.url, {
        method: "POST",
        headers: this.requestHeaders(),
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params: params || {} }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    const session = response.headers && response.headers.get && response.headers.get("mcp-session-id")
    if (session) this.sessionId = session
    if (!response.ok) throw new Error(`MCP request failed (${response.status})`)

    let message
    if ((response.headers.get("content-type") || "").includes("text/event-stream")) {
      await parseSse(response, event => {
        if (!message && event && (event.id === id || event.result || event.error)) message = event
      })
    } else {
      message = await response.json()
    }
    if (!message) throw new Error(`MCP response missing for ${method}`)
    if (message.error) {
      const error = new Error(message.error.message || "MCP error")
      error.code = message.error.code
      error.data = message.error.data
      throw error
    }
    return message.result || {}
  }
}
