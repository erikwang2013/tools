const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { createAgentServer } = require("../lib/server")

async function upstreamServer() {
  const server = http.createServer((req, res) => {
    const chunks = []
    req.on("data", chunk => chunks.push(chunk))
    req.on("end", () => {
      if (req.url === "/binary") {
        res.writeHead(200, { "content-type": "application/octet-stream" })
        res.end(Buffer.from([0, 1, 255]))
        return
      }
      res.writeHead(201, { "content-type": "text/plain" })
      res.end(Buffer.concat(chunks).toString() || "ok")
    })
  })
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  return server
}

test("proxies a request with token and CORS", async () => {
  const upstream = await upstreamServer()
  const target = `http://127.0.0.1:${upstream.address().port}/x`
  const srv = await createAgentServer({
    port: 0,
    token: "t",
    origins: ["https://tools.erik.xyz"],
    adapters: {},
  })
  const base = `http://127.0.0.1:${srv.port}`

  const res = await fetch(`${base}/proxy/http`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-token": "t",
      origin: "https://tools.erik.xyz",
    },
    body: JSON.stringify({ method: "GET", url: target, headers: {} }),
  })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("access-control-allow-origin"), "https://tools.erik.xyz")
  const body = await res.json()
  assert.equal(body.status, 201)
  assert.equal(body.data, "ok")
  assert.equal(body.encoding, "utf8")

  const denied = await fetch(`${base}/proxy/http`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-token": "bad",
      origin: "https://tools.erik.xyz",
    },
    body: JSON.stringify({ method: "GET", url: target, headers: {} }),
  })
  assert.equal(denied.status, 401)

  const forbidden = await fetch(`${base}/proxy/http`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-agent-token": "t",
      origin: "http://evil.example",
    },
    body: JSON.stringify({ method: "GET", url: target, headers: {} }),
  })
  assert.equal(forbidden.status, 403)

  const preflight = await fetch(`${base}/proxy/http`, {
    method: "OPTIONS",
    headers: { origin: "https://tools.erik.xyz" },
  })
  assert.equal(preflight.status, 204)

  await srv.close()
  await new Promise(resolve => upstream.close(resolve))
})

test("keeps binary responses base64 encoded", async () => {
  const upstream = await upstreamServer()
  const target = `http://127.0.0.1:${upstream.address().port}/binary`
  const srv = await createAgentServer({ port: 0, token: "t", origins: [], allowNoOrigin: true, adapters: {} })
  const res = await fetch(`http://127.0.0.1:${srv.port}/proxy/http`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-agent-token": "t" },
    body: JSON.stringify({ method: "GET", url: target, headers: {} }),
  })
  const body = await res.json()
  assert.equal(body.encoding, "base64")
  assert.deepEqual(Buffer.from(body.data, "base64"), Buffer.from([0, 1, 255]))
  await srv.close()
  await new Promise(resolve => upstream.close(resolve))
})
