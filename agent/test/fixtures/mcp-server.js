const readline = require("node:readline")

const rl = readline.createInterface({ input: process.stdin })
rl.on("line", line => {
  let message
  try {
    message = JSON.parse(line)
  } catch {
    return
  }
  if (message.method === "initialize") {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "fixture", version: "0" },
        },
      }) + "\n"
    )
  } else if (message.method === "tools/list") {
    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "echo" }] } }) + "\n"
    )
  } else if (message.method === "tools/call") {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: message.id,
        result: { content: [{ type: "text", text: message.params && message.params.arguments.text }] },
      }) + "\n"
    )
  }
})
