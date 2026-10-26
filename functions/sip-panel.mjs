export function buildSipTarget({ user, domain } = {}) {
  if (!user || !domain) throw new Error("user and domain are required")
  return `sip:${user}@${domain}`
}

export function resolveSipServer({ mode, wsUrl, bridgeUrl } = {}) {
  if (mode === "agent") {
    if (!bridgeUrl) throw new Error("agent mode requires a bridge URL")
    return bridgeUrl
  }
  return wsUrl
}
