const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const { createAgentServer } = require("../lib/server")
const adapters = require("../adapters")

test("runs a configured MCP stdio server", async () => {
  const srv = await createAgentServer({
    port: 0,
    token: "t",
    origins: [],
    allowNoOrigin: true,
    adapters,
    config: {
      mcpServers: {
        fixture: {
          command: process.execPath,
          args: [path.join(__dirname, "fixtures/mcp-server.js")],
        },
      },
    },
  })
  const manager = new (require("../lib/session").SessionManager)({
    adapters,
    emit: () => {},
    context: { port: srv.port, mcpServers: { fixture: { command: process.execPath, args: [path.join(__dirname, "fixtures/mcp-server.js")] } } },
  })
  const { ready } = await manager.open("m1", "mcp-stdio", { server: "fixture" })
  assert.equal(ready.name, "fixture")
  const events = []
  manager.emit = (id, event) => events.push(event)
  await manager.send("m1", {
    encoding: "utf8",
    data: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  })
  await new Promise(resolve => setTimeout(resolve, 100))
  const data = events.find(event => event.type === "data")
  assert.ok(data)
  assert.equal(JSON.parse(data.payload.data).result.serverInfo.name, "fixture")
  manager.close("m1")
  await srv.close()
})

test("rejects an unknown MCP server without exposing commands", async () => {
  const manager = new (require("../lib/session").SessionManager)({
    adapters,
    emit: () => {},
    context: { port: 0, mcpServers: {} },
  })
  await assert.rejects(manager.open("m2", "mcp-stdio", { server: "nope" }), /unknown MCP server/)
})
