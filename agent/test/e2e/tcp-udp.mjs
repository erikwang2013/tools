// Manual end-to-end check for the Phase 0 Protocol Lab agent. Not part of `node --test`.
// Run it with Node 18 from any directory: node agent/test/e2e/tcp-udp.mjs
// Optional env overrides: AGENT_PORT (3599), AGENT_TOKEN, AGENT_ORIGIN.
// It starts a TCP echo server and a UDP echo server on ephemeral ports, spawns the agent,
// checks auth/Origin rejection, TCP/UDP round-trips, residual sockets and SIGTERM exit 0.
import assert from "node:assert/strict"
import { once } from "node:events"
import { execFileSync, spawn } from "node:child_process"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import net from "node:net"
import dgram from "node:dgram"
import path from "node:path"

const REPO = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..")
const require = createRequire(import.meta.url)
const WebSocket = require(`${REPO}/agent/node_modules/ws`)
const { AgentClient } = await import(`file://${REPO}/functions/agent-client.mjs`)

const AGENT_PORT = Number(process.env.AGENT_PORT || 3599)
const TOKEN = process.env.AGENT_TOKEN || "task14-e2e-token"
const ORIGIN = process.env.AGENT_ORIGIN || "http://127.0.0.1:3000"
const AGENT_URL = `ws://127.0.0.1:${AGENT_PORT}/agent`

// The page always sends an allowed Origin; ws does not by default.
class OriginWebSocket extends WebSocket {
  constructor(url) {
    super(url, { origin: ORIGIN })
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitUntil(fn, what, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (fn()) return
    await sleep(50)
  }
  throw new Error(`timed out waiting for ${what}`)
}

function tcpEcho() {
  return new Promise(resolve => {
    const server = net.createServer(socket => socket.pipe(socket))
    server.listen(0, "127.0.0.1", () => resolve(server))
  })
}

function udpEcho() {
  return new Promise(resolve => {
    const socket = dgram.createSocket("udp4")
    socket.on("message", (message, rinfo) => socket.send(message, rinfo.port, rinfo.address))
    socket.bind(0, "127.0.0.1", () => resolve(socket))
  })
}

function ss(flag) {
  return execFileSync("ss", [flag], { encoding: "utf8" })
}

function agentSockets(flag, pid) {
  return ss(flag)
    .split("\n")
    .filter(line => line.includes(`pid=${pid}`))
}

const tcpServer = await tcpEcho()
const udpSocket = await udpEcho()
const tcpPort = tcpServer.address().port
const udpPort = udpSocket.address().port

const agent = spawn(
  process.execPath,
  ["agent/index.js", "--port", String(AGENT_PORT), "--token", TOKEN],
  {
    cwd: REPO,
    stdio: ["ignore", "pipe", "pipe"],
  }
)
let agentOut = ""
let agentErr = ""
agent.stdout.on("data", chunk => (agentOut += chunk))
agent.stderr.on("data", chunk => (agentErr += chunk))

let client
let failed = false
try {
  await waitUntil(
    () => agentOut.includes(AGENT_URL) && agentOut.includes("Token:"),
    "agent startup"
  )
  console.log(
    "agent startup:",
    agentOut
      .trim()
      .split("\n")
      .join(" | ")
  )

  const health = await fetch(`http://127.0.0.1:${AGENT_PORT}/health`)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { ok: true })
  console.log("health endpoint: 200 {ok:true}")

  // Wrong token is rejected, correct token authenticates.
  const badClient = new AgentClient({ WebSocketImpl: OriginWebSocket })
  await assert.rejects(badClient.connect(AGENT_URL, "wrong-token"), /invalid token/)
  badClient.disconnect()
  console.log("wrong token: rejected with 'invalid token'")

  // Non-allowlisted Origin is refused before the WebSocket upgrade.
  const badOrigin = new WebSocket(AGENT_URL, { origin: "http://evil.example" })
  const [originError] = await once(badOrigin, "error")
  assert.match(originError.message, /403/)
  console.log("bad origin: refused with", originError.message)

  client = new AgentClient({ WebSocketImpl: OriginWebSocket })
  const events = []
  client.addEventListener("session", event => events.push(event.detail))
  await client.connect(AGENT_URL, TOKEN)
  assert.equal(client.status, "connected")
  console.log("auth: connected")

  const received = (sessionId, text) =>
    events.some(event => {
      if (event.sessionId !== sessionId || event.type !== "data") return false
      return Buffer.from(event.payload.data, "base64").toString() === text
    })

  const tcp = await client.open("tcp", { host: "127.0.0.1", port: tcpPort, encoding: "base64" })
  await client.send(tcp.sessionId, { encoding: "utf8", data: "hello-tcp" })
  await waitUntil(() => received(tcp.sessionId, "hello-tcp"), "TCP echo")
  console.log("TCP round-trip: hello-tcp -> hello-tcp (base64 receive encoding)")

  const udp = await client.open("udp", {
    host: "127.0.0.1",
    port: udpPort,
    bindPort: 0,
    encoding: "base64",
  })
  await client.send(udp.sessionId, { encoding: "utf8", data: "hello-udp" })
  await waitUntil(() => received(udp.sessionId, "hello-udp"), "UDP echo")
  const udpData = events.find(
    event =>
      event.sessionId === udp.sessionId &&
      event.type === "data" &&
      Buffer.from(event.payload.data, "base64").toString() === "hello-udp"
  )
  assert.match(udpData.payload.remote, /^127\.0\.0\.1:\d+$/)
  console.log("UDP round-trip: hello-udp -> hello-udp, remote =", udpData.payload.remote)

  await client.close(tcp.sessionId)
  await client.close(udp.sessionId)
  await waitUntil(
    () =>
      events.filter(
        event =>
          event.type === "closed" &&
          (event.sessionId === tcp.sessionId || event.sessionId === udp.sessionId)
      ).length === 2,
    "both sessions closed"
  )
  console.log("sessions closed: agent emitted closed for TCP and UDP")

  await sleep(300)
  const tcpLeft = agentSockets("-tanp", agent.pid).filter(line => line.includes(`:${tcpPort}`))
  const udpLeft = agentSockets("-uanp", agent.pid)
  assert.deepEqual(tcpLeft, [], `residual TCP sockets: ${tcpLeft.join("\n")}`)
  assert.deepEqual(udpLeft, [], `residual UDP sockets: ${udpLeft.join("\n")}`)
  console.log("residual sockets after session close: none (agent pid", agent.pid + ")")

  client.disconnect()
  await sleep(300)
  assert.deepEqual(agentSockets("-uanp", agent.pid), [])
  const tcpAfterDisconnect = agentSockets("-tanp", agent.pid).filter(line =>
    line.includes(`:${tcpPort}`)
  )
  assert.deepEqual(tcpAfterDisconnect, [])
  console.log("residual sockets after WebSocket disconnect: none")

  agent.kill("SIGTERM")
  const [code] = await once(agent, "exit")
  assert.equal(code, 0)
  await waitUntil(
    () =>
      !ss("-ltnp")
        .split("\n")
        .some(line => line.includes(`:${AGENT_PORT}`)),
    "agent listener removal"
  )
  console.log("agent SIGTERM: exit 0, listener on port", AGENT_PORT, "removed")
  console.log("E2E PASS")
} catch (error) {
  failed = true
  console.error("E2E FAIL:", error.message)
  console.error("agent stdout:", agentOut)
  console.error("agent stderr:", agentErr)
} finally {
  if (client) client.disconnect()
  if (agent.exitCode === null) {
    agent.kill("SIGTERM")
    await Promise.race([once(agent, "exit"), sleep(2000)]).catch(() => {})
    if (agent.exitCode === null) agent.kill("SIGKILL")
  }
  tcpServer.close()
  udpSocket.close()
}
process.exit(failed ? 1 : 0)
