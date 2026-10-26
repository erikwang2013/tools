export function formatFrameLog(frame = {}) {
  const headers = Object.entries(frame.headers || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")
  return `${frame.command || ""}\n${headers}${headers ? "\n\n" : "\n"}${frame.body || ""}`
}

export function resolveBrokerUrl({ mode, brokerUrl, bridgeUrl } = {}) {
  if (mode === "agent") {
    if (!bridgeUrl) throw new Error("agent mode requires a bridge URL")
    return bridgeUrl
  }
  return brokerUrl
}
