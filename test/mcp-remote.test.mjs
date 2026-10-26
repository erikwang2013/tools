import test from "node:test"
import assert from "node:assert/strict"
import { McpRemoteClient } from "../functions/mcp-remote.mjs"

test("initializes, keeps session id and lists tools", async () => {
  const seen = []
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body)
    seen.push({ url, body, headers: init.headers })
    if (body.method === "initialize") {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2024-11-05" } }),
        { status: 200, headers: { "mcp-session-id": "s1", "content-type": "application/json" } }
      )
    }
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "echo" }] } }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  }
  const client = new McpRemoteClient({ url: "https://m.test/mcp", headers: {}, fetchImpl })
  await client.initialize()
  assert.equal(seen[0].headers["mcp-session-id"], undefined)
  assert.equal(seen[1].headers["mcp-session-id"], "s1")
  assert.deepEqual(await client.listTools(), [{ name: "echo" }])
})

test("surfaces JSON-RPC errors", async () => {
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body)
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "nope" } }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  }
  const client = new McpRemoteClient({ url: "https://m.test/mcp", fetchImpl })
  await assert.rejects(client.listTools(), error => error.code === -32601)
})
