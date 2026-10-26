import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { createAgentFetch } from "../functions/agent-http.mjs"
const require = createRequire(import.meta.url)
const http = require("node:http")
const { createAgentServer } = require("../agent/lib/server.js")

async function upstreamServer() {
  const server = http.createServer((req, res) => {
    const chunks = []
    req.on("data", chunk => chunks.push(chunk))
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ method: req.method, body: Buffer.concat(chunks).toString() }))
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  return server
}

test("agent fetch posts the envelope and returns the upstream response", async () => {
  const upstream = await upstreamServer()
  const target = `http://127.0.0.1:${upstream.address().port}/echo`
  const srv = await createAgentServer({
    port: 0,
    token: "t",
    origins: [],
    allowNoOrigin: true,
    adapters: {},
  })
  const agentFetch = createAgentFetch({ url: `http://127.0.0.1:${srv.port}`, token: "t" })
  const res = await agentFetch(target, { method: "POST", headers: { "content-type": "text/plain" }, body: "hi" })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { method: "POST", body: "hi" })
  await srv.close()
  await new Promise(resolve => upstream.close(resolve))
})

test("agent fetch reports an offline agent", async () => {
  const agentFetch = createAgentFetch({ url: "http://127.0.0.1:1", token: "t" })
  await assert.rejects(agentFetch("http://example.test/"), error => error.code === "AGENT_OFFLINE")
})
