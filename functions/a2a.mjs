import { parseSse } from "./sse.mjs"

function base(url) {
  return String(url || "").replace(/\/$/, "")
}

function messageId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export async function fetchAgentCard(baseUrl, { fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(`${base(baseUrl)}/.well-known/agent-card.json`)
  if (!response.ok) throw new Error(`agent card request failed (${response.status})`)
  return response.json()
}

export async function sendA2AMessage({
  endpoint,
  message,
  contextId,
  fetchImpl = globalThis.fetch,
} = {}) {
  const params = {
    message: {
      role: "user",
      parts: [{ kind: "text", text: message }],
      messageId: messageId(),
    },
  }
  if (contextId) params.contextId = contextId
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "message/send", params }),
  })
  if (!response.ok) {
    throw new Error(`A2A request failed (${response.status}): ${await response.text()}`)
  }
  if ((response.headers.get("content-type") || "").includes("text/event-stream")) {
    let last
    await parseSse(response, event => {
      last = event
    })
    return last
  }
  return response.json()
}

export { parseSse }
