export function buildMessageStanza({ to, body } = {}) {
  return { name: "message", attrs: { to }, children: [{ name: "body", text: body || "" }] }
}

export function resolveService({ mode, serviceUrl, bridgeUrl } = {}) {
  if (mode === "agent") {
    if (!bridgeUrl) throw new Error("agent mode requires a bridge URL")
    return bridgeUrl
  }
  return serviceUrl
}
