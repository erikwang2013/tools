export async function parseSse(response, onEvent) {
  const text = await response.text()
  let data = []
  const flush = () => {
    if (!data.length) return
    const payload = data.join("\n")
    data = []
    try {
      onEvent(JSON.parse(payload))
    } catch {
      // Non-JSON SSE payloads are not part of the MCP/A2A contracts.
    }
  }
  for (const raw of text.split(/\r?\n/)) {
    if (raw === "") {
      flush()
      continue
    }
    if (raw.startsWith(":")) continue
    const index = raw.indexOf(":")
    const field = index === -1 ? raw : raw.slice(0, index)
    let value = index === -1 ? "" : raw.slice(index + 1)
    if (value.startsWith(" ")) value = value.slice(1)
    if (field === "data") data.push(value)
  }
  flush()
}
