import { base64ToBytes, bytesToBase64 } from "./bytes.mjs"

// Reads the same settings the Settings page stores; call only from the browser.
export function agentFetchFromSettings() {
  const url = typeof localStorage === "undefined" ? "" : localStorage.getItem("postwoman.agent.url")
  const token =
    typeof sessionStorage === "undefined" ? "" : sessionStorage.getItem("postwoman.agent.token")
  if (!url || !token) throw new Error("Connect the local agent in Settings first")
  return createAgentFetch({
    url: url.replace(/^ws/, "http").replace(/\/agent\/?$/, ""),
    token,
  })
}

export function createAgentFetch({ url, token, fetchImpl = globalThis.fetch } = {}) {
  if (typeof url !== "string" || url === "") throw new Error("agent url is required")
  if (typeof token !== "string" || token === "") throw new Error("agent token is required")
  const base = url.replace(/\/$/, "")

  return async function agentFetch(input, init) {
    const request = new Request(input, init)
    const hasBody = init && init.body !== undefined && init.body !== null
    const payload = {
      method: request.method,
      url: request.url,
      headers: Object.fromEntries(request.headers),
    }
    if (hasBody) {
      const body = new Uint8Array(await request.arrayBuffer())
      payload.data = bytesToBase64(body)
      payload.encoding = "base64"
    }

    let response
    try {
      response = await fetchImpl(`${base}/proxy/http`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-agent-token": token },
        body: JSON.stringify(payload),
      })
    } catch (error) {
      const offline = new Error(`agent unreachable: ${error.message}`)
      offline.code = "AGENT_OFFLINE"
      throw offline
    }
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`agent proxy failed (${response.status}): ${text}`)
    }
    const result = await response.json()
    const body =
      result.data == null
        ? null
        : result.encoding === "base64"
          ? base64ToBytes(result.data)
          : result.data
    const headers = new Headers(result.headers || {})
    // The agent already decoded the body; these headers describe the wire form.
    headers.delete("content-encoding")
    headers.delete("content-length")
    headers.delete("transfer-encoding")
    return new Response(body, { status: result.status, headers })
  }
}
