# Protocol Lab 阶段 0：框架与 TCP/UDP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立本地 Agent、协议注册表、通用实验台和 TCP/UDP 两个协议条目，端到端可用。

**Architecture:** Agent 是独立 Node 18 CommonJS 进程，通过同一端口提供 WebSocket（`/agent`）与本地 HTTP 端点。页面用 `AgentClient` 管理会话；实验台由注册表描述驱动，TCP/UDP 作为首批适配器。

**Tech Stack:** Node 18、`ws`、`node:test`、Nuxt 2、Vue 2、Cypress 4。

**Spec:** `docs/superpowers/specs/2026-10-24-protocol-lab-design.md`
**共享契约:** `docs/superpowers/plans/2026-10-24-protocol-lab-index.md`（信封、适配器接口、注册表、AgentClient、命令）

## Global Constraints

- 只用 Node 18；Agent 用 CommonJS；页面纯逻辑用 `.mjs`。
- Agent 只绑 `127.0.0.1`，默认端口 3567；token 每次启动随机生成；Origin 白名单见索引。
- 单条消息 16 MiB；每页最多 32 会话；`open` 超时 30 秒；已建立会话不因空闲回收；ping 30 秒、60 秒无 pong 回收。
- 页面不向 Agent 传文件路径；新协议不接入集合/历史/环境变量/前置脚本。
- 协议名英文；新增 UI 文案只进 `lang/en-US.json`。
- 已有协议页面不动。本阶段不修改 `pages/index.vue`、`pages/graphql.vue`、`pages/realtime.vue`。
- 每个任务结束跑对应测试；最后跑 `npm run generate` 与 Cypress。

## Review Focus

1. Agent 未启动或端口被占用时，页面必须给出可操作提示，浏览器原生协议不受影响（Task 11、Task 13 的测试）。
2. 错误 token 或非白名单 Origin 必须被拒绝，且不创建任何会话（Task 2、Task 7）。
3. 页面关闭、WS 断开或 Agent 退出时，所有 socket、定时器、会话必须回收（Task 3、Task 4、Task 5）。
4. 超过 16 MiB 的消息、非法 hex、非法 base64 必须给出明确错误，不得崩溃（Task 1、Task 8、Task 10）。
5. 端口已被占用或第二个实例启动时，必须打印清晰错误并退出（Task 6）。

---

### Task 0: 基线验证

**Files:** 无（只读检查）

**Interfaces:**
- Consumes: 现有仓库
- Produces: 后续任务可依赖的绿色基线

- [ ] **Step 1: 确认 Node 版本**

Run: `node -v`
Expected: `v18.x`（不是 16 或 20；Nuxt 2 构建要求 16–18）

- [ ] **Step 2: 确认现有构建通过**

Run: `npm run generate`
Expected: 退出码 0，`dist/` 生成

- [ ] **Step 3: 确认现有 e2e 通过**

Run: `npx cypress run`
Expected: 现有 11 个用例全部通过

- [ ] **Step 4: 记录基线**

在计划执行记录里写下 Node 版本、生成耗时、e2e 结果；后续阶段用它判断回归。

---

### Task 1: Agent 脚手架、信封、载荷工具

**Files:**
- Create: `agent/package.json`
- Create: `agent/lib/envelope.js`
- Create: `agent/lib/payload.js`
- Create: `agent/test/envelope.test.js`
- Create: `agent/test/payload.test.js`
- Modify: `package.json`（新增 `agent`、`test:unit`、`test:agent` 脚本）

**Interfaces:**
- Consumes: 无
- Produces:
  - `encode(message) -> string`
  - `decode(raw, { maxBytes? }) -> message`，失败抛 `ProtocolError { code }`
  - `MAX_MESSAGE_BYTES = 16 * 1024 * 1024`
  - `toBuffer({ encoding, data }) -> Buffer`
  - `fromBuffer(buf, { encoding = "base64" }) -> { encoding, data, bytes }`

- [ ] **Step 1: 写信封失败测试**

`agent/test/envelope.test.js`（CommonJS）：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const { encode, decode, ProtocolError } = require("../lib/envelope")

test("round-trips an open message", () => {
  const msg = { v: 1, type: "open", id: "s1", protocol: "tcp", config: { host: "127.0.0.1" } }
  assert.deepEqual(decode(encode(msg)), msg)
})

test("rejects unknown version and type", () => {
  assert.throws(() => decode('{"v":2,"type":"open","id":"s1"}'), ProtocolError)
  assert.throws(() => decode('{"v":1,"type":"nope","id":"s1"}'), ProtocolError)
})

test("rejects oversized messages", () => {
  const raw = JSON.stringify({ v: 1, type: "auth", token: "x".repeat(100) })
  assert.throws(() => decode(raw, { maxBytes: 32 }), ProtocolError)
})

test("rejects missing id for session messages", () => {
  assert.throws(() => decode('{"v":1,"type":"send","id":""}'), ProtocolError)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm --prefix agent test`
Expected: FAIL，`Cannot find module '../lib/envelope'`

- [ ] **Step 3: 实现信封**

`agent/lib/envelope.js`：

```js
const MAX_MESSAGE_BYTES = 16 * 1024 * 1024
const TYPES = new Set(["auth","open","send","close","auth:ok","auth:fail","ready","log","data","error","closed"])

class ProtocolError extends Error {
  constructor(message, code = "PROTOCOL_ERROR") { super(message); this.code = code }
}

function encode(message) { /* validate + JSON.stringify; throw ProtocolError */ }
function decode(raw, { maxBytes = MAX_MESSAGE_BYTES } = {}) {
  // 1. Buffer.byteLength(raw) > maxBytes -> ProtocolError("message too large", "TOO_LARGE")
  // 2. JSON.parse 失败 -> ProtocolError("invalid json")
  // 3. v !== 1 / type 不在 TYPES / session 类型缺 id -> ProtocolError
  // 4. 返回对象
}

module.exports = { encode, decode, ProtocolError, MAX_MESSAGE_BYTES, TYPES }
```

- [ ] **Step 4: 写载荷失败测试**

`agent/test/payload.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const { toBuffer, fromBuffer } = require("../lib/payload")

test("converts utf8 and base64 payloads", () => {
  assert.equal(toBuffer({ encoding: "utf8", data: "hi" }).toString(), "hi")
  assert.equal(toBuffer({ encoding: "base64", data: "aGk=" }).toString(), "hi")
})

test("rejects invalid encoding and base64", () => {
  assert.throws(() => toBuffer({ encoding: "hex", data: "00" }))
  assert.throws(() => toBuffer({ encoding: "base64", data: "!!!" }))
})

test("fromBuffer returns base64 with byte length", () => {
  assert.deepEqual(fromBuffer(Buffer.from("hi")), { encoding: "base64", data: "aGk=", bytes: 2 })
})
```

- [ ] **Step 5: 运行测试确认失败**

Run: `npm --prefix agent test`
Expected: FAIL，`Cannot find module '../lib/payload'`

- [ ] **Step 6: 实现载荷工具与 Agent package**

`agent/package.json`：

```json
{
  "name": "postwoman-agent",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=18 <19" },
  "scripts": { "start": "node index.js", "test": "node --test test/" },
  "dependencies": { "ws": "^8.18.0" }
}
```

`agent/lib/payload.js`：实现 `toBuffer`（只接受 `utf8`/`base64`；base64 用 `/^[A-Za-z0-9+/]*={0,2}$/` 且长度为 4 的倍数校验）与 `fromBuffer`。

根 `package.json` scripts 增加：

```json
"agent": "node agent/index.js",
"test:unit": "node --test test",
"test:agent": "npm --prefix agent test"
```

- [ ] **Step 7: 安装并运行测试**

Run: `npm --prefix agent install && npm run test:agent`
Expected: 7 个用例全部 PASS

- [ ] **Step 8: Commit（或检查点）**

```bash
git add agent/package.json agent/package-lock.json agent/lib/envelope.js agent/lib/payload.js agent/test package.json
git commit -m "feat(agent): add envelope and payload codec"
```

---

### Task 2: Origin 白名单、HTTP/WS 服务、鉴权

**Files:**
- Create: `agent/lib/origin.js`
- Create: `agent/lib/server.js`
- Create: `agent/test/origin.test.js`
- Create: `agent/test/server.test.js`
- Modify: `agent/adapters/index.js`（创建，先导出空对象即可供测试注入）

**Interfaces:**
- Consumes: Task 1 的 `encode`/`decode`
- Produces:
  - `isAllowedOrigin(origin, allowlist) -> boolean`
  - `DEFAULT_ORIGINS: string[]`
  - `createAgentServer({ port, host, token, origins, adapters, config, allowNoOrigin }) -> Promise<{ server, wss, token, port, close }>`
  - WS 路径 `/agent`；`GET /health` 返回 `{ ok: true }`

- [ ] **Step 1: 写 Origin 失败测试**

`agent/test/origin.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const { isAllowedOrigin, DEFAULT_ORIGINS } = require("../lib/origin")

test("allows the documented origins only", () => {
  assert.equal(isAllowedOrigin("https://postwoman.erik.xyz", DEFAULT_ORIGINS), true)
  assert.equal(isAllowedOrigin("http://localhost:3000", DEFAULT_ORIGINS), true)
  assert.equal(isAllowedOrigin("https://evil.example", DEFAULT_ORIGINS), false)
  assert.equal(isAllowedOrigin(undefined, DEFAULT_ORIGINS), false)
})
```

- [ ] **Step 2: 写服务鉴权失败测试**

`agent/test/server.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const WebSocket = require("ws")
const { createAgentServer } = require("../lib/server")

async function start() {
  return createAgentServer({
    port: 0, token: "test-token", origins: [], allowNoOrigin: true, adapters: {},
  })
}

test("serves health without auth", async () => {
  const srv = await start()
  const res = await fetch(`http://127.0.0.1:${srv.port}/health`)
  assert.deepEqual(await res.json(), { ok: true })
  await srv.close()
})

test("rejects a wrong token and accepts the right one", async () => {
  const srv = await start()
  const bad = new WebSocket(`ws://127.0.0.1:${srv.port}/agent`)
  const badReply = await new Promise((resolve, reject) => {
    bad.on("open", () => bad.send(JSON.stringify({ v: 1, type: "auth", token: "nope" })))
    bad.on("message", raw => resolve(JSON.parse(raw)))
    bad.on("error", reject)
  })
  assert.equal(badReply.type, "auth:fail")

  const good = new WebSocket(`ws://127.0.0.1:${srv.port}/agent`)
  const ok = await new Promise((resolve, reject) => {
    good.on("open", () => good.send(JSON.stringify({ v: 1, type: "auth", token: "test-token" })))
    good.on("message", raw => resolve(JSON.parse(raw)))
    good.on("error", reject)
  })
  assert.equal(ok.type, "auth:ok")
  good.close()
  await srv.close()
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，`Cannot find module '../lib/origin'` / `../lib/server`

- [ ] **Step 4: 实现 Origin 与服务器**

`agent/lib/origin.js`：导出 `DEFAULT_ORIGINS`（与索引一致）与严格相等比较的 `isAllowedOrigin`。

`agent/lib/server.js`：

- 用 `http.createServer` + `new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES })`。
- `upgrade` 时校验 `origin`；不允许则 `socket.write("HTTP/1.1 403 Forbidden\r\n\r\n")` 并 `destroy()`。
- 每次连接状态 `{ authed: false, sessions: new Map() }`；第一条消息必须是 `auth`；用 `crypto.timingSafeEqual` 比较等长 token。
- 每 30 秒对每个连接 `ws.ping()`，用 `ws.isAlive` 标记；60 秒无 pong 则 `ws.terminate()` 并清理会话。`close()` 清除 interval。
- 鉴权失败发 `{ v:1, type:"auth:fail", error:"invalid token" }` 后 `ws.close(4001)`。
- 鉴权成功后 `auth:ok`；`/health` 返回 `{ ok: true }`。
- `close()` 关闭 wss、所有 socket、HTTP server，并返回 Promise。
- `port` 取自 `server.address().port`（支持 0）。
- 本任务先不处理 `open/send/close`（Task 3 接会话管理器后再接）；未知消息返回 `error`。

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test:agent`
Expected: PASS（Task 1 的 7 个 + 新增 2 个）

- [ ] **Step 6: Commit**

```bash
git add agent/lib/origin.js agent/lib/server.js agent/adapters/index.js agent/test
git commit -m "feat(agent): add loopback server with origin and token auth"
```

---

### Task 3: 会话管理器（假适配器）

**Files:**
- Create: `agent/lib/session.js`
- Create: `agent/test/session.test.js`
- Modify: `agent/lib/server.js`（接入 `SessionManager`）

**Interfaces:**
- Consumes: 适配器接口（见索引）
- Produces:
  - `class SessionManager { constructor({ adapters, emit, maxSessions, openTimeoutMs, context }); open(id, protocol, config); send(id, payload); close(id); closeAll() }`
  - `open` 返回 `{ ready }`；适配器 `create(config, emit, context)` 返回 `{ send, close, ready? }`

- [ ] **Step 1: 写会话管理器失败测试**

`agent/test/session.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const { SessionManager } = require("../lib/session")

function fakeAdapter() {
  const calls = { sent: [], closed: 0 }
  return {
    calls,
    adapter: {
      id: "fake",
      async create(config, emit) {
        return {
          ready: { echoed: config.value },
          send(payload) { calls.sent.push(payload); emit({ type: "data", payload: { encoding: "utf8", data: payload.data, bytes: 1 } }) },
          close() { calls.closed += 1 },
        }
      },
    },
  }
}

test("opens, sends, closes and emits with session id", async () => {
  const { adapter, calls } = fakeAdapter()
  const events = []
  const mgr = new SessionManager({ adapters: { fake: adapter }, emit: (id, e) => events.push([id, e]) })
  const { ready } = await mgr.open("s1", "fake", { value: "ok" })
  assert.deepEqual(ready, { echoed: "ok" })
  await mgr.send("s1", { encoding: "utf8", data: "hi" })
  assert.deepEqual(calls.sent, [{ encoding: "utf8", data: "hi" }])
  assert.equal(events[0][0], "s1")
  mgr.close("s1")
  assert.equal(calls.closed, 1)
  mgr.close("s1")
  assert.equal(calls.closed, 1, "close must be idempotent")
})

test("rejects unknown protocol and enforces max sessions", async () => {
  const { adapter } = fakeAdapter()
  const mgr = new SessionManager({ adapters: { fake: adapter }, emit: () => {}, maxSessions: 1 })
  await assert.rejects(() => mgr.open("a", "nope", {}), /unknown protocol/i)
  await mgr.open("a", "fake", { value: 1 })
  await assert.rejects(() => mgr.open("b", "fake", { value: 2 }), /too many sessions/i)
})

test("times out a hanging open", async () => {
  const adapter = { id: "hang", create: () => new Promise(() => {}) }
  const mgr = new SessionManager({ adapters: { hang: adapter }, emit: () => {}, openTimeoutMs: 10 })
  await assert.rejects(() => mgr.open("a", "hang", {}), /timed out/i)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，`Cannot find module '../lib/session'`

- [ ] **Step 3: 实现 SessionManager**

`agent/lib/session.js` 要点：

- `open` 检查协议存在、会话数上限、id 未占用；用 `setTimeout` 包装 `adapter.create(config, emit, context)` 的 30 秒超时；失败时清理。
- `context` 由 `createAgentServer` 注入（`port`、`hookRouter`、`bridgeRegistry`、`mcpServers`），普通适配器忽略。
- `emit(sessionId, event)` 透传；`send`/`close` 对未知 id 抛错（服务器转成 `error`）。
- `close` 调用适配器 `close()` 一次并从 Map 删除。
- 适配器 `create` 抛错时，管理器向 `emit` 推一条 `error`，不再注册会话。
- `closeAll()` 遍历并关闭。

在 `agent/lib/server.js` 中：鉴权成功后创建 `SessionManager`，处理 `open/send/close`：

- `open` 成功 → `{ v:1, type:"ready", id, payload: ready }`；失败 → `error` + `closed`。
- `send` 失败 → `error`。
- `close` → 适配器关闭后发 `closed`（若适配器尚未发过）。
- 连接关闭 → `manager.closeAll()`。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:agent`
Expected: PASS（新增 3 个用例）

- [ ] **Step 5: Commit**

```bash
git add agent/lib/session.js agent/lib/server.js agent/test/session.test.js
git commit -m "feat(agent): add session lifecycle manager"
```

---

### Task 4: TCP 适配器

**Files:**
- Create: `agent/adapters/tcp.js`
- Create: `agent/test/tcp.test.js`
- Modify: `agent/adapters/index.js`

**Interfaces:**
- Consumes: `toBuffer`/`fromBuffer`、适配器接口
- Produces: 注册表键 `tcp`；config `{ host, port, encoding: "utf8"|"base64" }`

- [ ] **Step 1: 写 TCP 失败测试**

`agent/test/tcp.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const tcp = require("../adapters/tcp")

test("connects, echoes data and emits base64 payloads", async () => {
  const server = net.createServer(socket => socket.pipe(socket))
  await new Promise(r => server.listen(0, "127.0.0.1", r))
  const port = server.address().port
  const events = []
  const session = await tcp.create(
    { host: "127.0.0.1", port, encoding: "base64" },
    e => events.push(e)
  )
  await session.send({ encoding: "utf8", data: "ping" })
  await new Promise(r => setTimeout(r, 100))
  assert.equal(events.some(e => e.type === "data" && e.payload.data === "cGluZw=="), true)
  session.close()
  await new Promise(r => setTimeout(r, 50))
  assert.equal(events.at(-1).type, "closed")
  await new Promise(r => server.close(r))
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，`Cannot find module '../adapters/tcp'`

- [ ] **Step 3: 实现 TCP 适配器**

`agent/adapters/tcp.js`：

```js
module.exports = {
  id: "tcp",
  create(config, emit) {
    return new Promise((resolve, reject) => {
      const socket = require("node:net").connect({ host: config.host, port: Number(config.port) })
      // error before connect -> reject；connect 后 error -> emit error
      // data -> emit({ type:"data", payload: fromBuffer(buf, { encoding: config.encoding || "base64" }) })
      // close -> emit({ type:"closed", payload:{ reason:"socket closed" } })
      // resolve({ send(payload){ socket.write(toBuffer(payload)) }, close(){ socket.destroy() } })
    })
  },
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:agent`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/adapters/tcp.js agent/adapters/index.js agent/test/tcp.test.js
git commit -m "feat(agent): add TCP adapter"
```

---

### Task 5: UDP 适配器

**Files:**
- Create: `agent/adapters/udp.js`
- Create: `agent/test/udp.test.js`
- Modify: `agent/adapters/index.js`

**Interfaces:**
- Consumes: `toBuffer`/`fromBuffer`
- Produces: 注册表键 `udp`；config `{ host, port, bindPort: number, encoding }`；`data.payload.remote = "<ip>:<port>"`

- [ ] **Step 1: 写 UDP 失败测试**

`agent/test/udp.test.js`：启动 `dgram` echo server，`udp.create({ host:"127.0.0.1", port, bindPort:0, encoding:"base64" }, emit)`，发送 `"ping"`，断言收到 `cGluZw==` 且 `payload.remote` 匹配 `/^127\.0\.0\.1:\d+$/`；`close()` 后 socket 关闭。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，`Cannot find module '../adapters/udp'`

- [ ] **Step 3: 实现 UDP 适配器**

`agent/adapters/udp.js`：`dgram.createSocket("udp4")`，先 `bind(bindPort || 0)` 再 resolve；`message` 事件 emit；`send` 用 `socket.send(buf, port, host)`；`close` 幂等。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:agent`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/adapters/udp.js agent/adapters/index.js agent/test/udp.test.js
git commit -m "feat(agent): add UDP adapter"
```

---

### Task 6: Agent CLI、配置、启动脚本

**Files:**
- Create: `agent/index.js`
- Create: `agent/config.example.json`
- Create: `agent/README.md`
- Create: `agent/test/cli.test.js`

**Interfaces:**
- Consumes: `createAgentServer`
- Produces: `node agent/index.js` 启动并打印 URL/token；`--port`、`--origin`、`--token`、`--config` 参数

- [ ] **Step 1: 写 CLI 失败测试**

`agent/test/cli.test.js`：用 `child_process.spawn(process.execPath, ["agent/index.js", "--port", "0", "--token", "test-token", "--origin", "http://localhost:3000"])`，等待 stdout 包含 `Token: test-token` 与 `ws://127.0.0.1:`；然后 SIGTERM，断言退出码 0。另起一个 `net` server 占用固定端口，spawn CLI 用同一端口，断言 stderr 含 `already in use` 且退出码非 0。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，找不到 `agent/index.js`

- [ ] **Step 3: 实现 CLI**

`agent/index.js`：

- 手动解析参数；`--host` 只允许 `127.0.0.1`，否则打印错误并 `process.exit(1)`。
- 默认 token：`crypto.randomBytes(24).toString("hex")`。
- 监听成功后打印实际端口：

```
Postwoman Agent listening on ws://127.0.0.1:<port>/agent
Token: <token>
Allowed origins: <comma list>
Press Ctrl+C to stop.
```

- `EADDRINUSE` 时打印 `Port <port> is already in use. Start with --port <other>.` 并退出码 1。
- SIGINT/SIGTERM → `close()` → 退出 0。

`agent/config.example.json`：

```json
{ "mcpServers": { "example": { "command": "node", "args": ["path/to/server.js"], "env": {} } } }
```

`agent/README.md`：启动命令、token、Origin、Chrome/Edge 本地网络访问授权、Safari 不支持、安全边界。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:agent`
Expected: PASS

- [ ] **Step 5: 手动启动检查**

Run: `npm run agent`
Expected: 打印 URL 与 token；Ctrl+C 正常退出

- [ ] **Step 6: Commit**

```bash
git add agent/index.js agent/config.example.json agent/README.md agent/test/cli.test.js package.json
git commit -m "feat(agent): add CLI and startup docs"
```

---

### Task 7: 浏览器 AgentClient

**Files:**
- Create: `functions/agent-client.mjs`
- Create: `agent/test/client.test.mjs`

**Interfaces:**
- Consumes: 信封、`createAgentServer`
- Produces: `AgentClient` 与单例 `agentClient`（见索引）；事件 `status`、`session`

- [ ] **Step 1: 写 AgentClient 失败测试**

`agent/test/client.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import WebSocket from "ws"
import { createRequire } from "node:module"
import { AgentClient } from "../../functions/agent-client.mjs"
const require = createRequire(import.meta.url)
const { createAgentServer } = require("../lib/server")

const echo = {
  id: "echo",
  async create(config, emit) {
    return {
      ready: { greeted: true },
      send(payload) { emit({ type: "data", payload: { encoding: "utf8", data: payload.data, bytes: payload.data.length } }) },
      close() { emit({ type: "closed", payload: { reason: "test" } }) },
    }
  },
}

test("connects, opens, sends and receives", async () => {
  const srv = await createAgentServer({ port: 0, token: "t", origins: [], allowNoOrigin: true, adapters: { echo } })
  const client = new AgentClient({ WebSocketImpl: WebSocket })
  const seen = []
  client.addEventListener("session", e => seen.push(e.detail))
  await client.connect(`ws://127.0.0.1:${srv.port}/agent`, "t")
  const { sessionId, payload } = await client.open("echo", {})
  assert.deepEqual(payload, { greeted: true })
  await client.send(sessionId, { encoding: "utf8", data: "hi" })
  await new Promise(r => setTimeout(r, 50))
  assert.equal(seen.some(e => e.type === "data" && e.payload.data === "hi"), true)
  await client.close(sessionId)
  client.disconnect()
  await srv.close()
})

test("rejects a wrong token", async () => {
  const srv = await createAgentServer({ port: 0, token: "t", origins: [], allowNoOrigin: true, adapters: {} })
  const client = new AgentClient({ WebSocketImpl: WebSocket })
  await assert.rejects(() => client.connect(`ws://127.0.0.1:${srv.port}/agent`, "bad"), /invalid token/i)
  await srv.close()
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，找不到 `../../functions/agent-client.mjs`

- [ ] **Step 3: 实现 AgentClient**

`functions/agent-client.mjs` 要点：

- `connect(url, token)`：`new WebSocketImpl(url)`；open 后发 `auth`；收到 `auth:ok` resolve；`auth:fail`/error/timeout reject；状态事件。
- `open(protocol, config)`：生成 `${Date.now().toString(36)}-${counter++}`，登记 pending，超时 `timeoutMs`（默认 30000，与 Agent 的 open 超时一致）；收到 `ready` resolve `{ sessionId, payload }`；`error` reject 并从 pending 删除。
- `send`/`close` 直接发消息；未知 session 直接 reject。
- 收到 `log/data/error/closed`：dispatch `session` 事件 `{ sessionId, type, payload }`。
- WS close：状态 `disconnected`，所有 pending reject。
- `disconnect()` 幂等，先发 close？直接 `ws.close()`，Agent 会清理。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:agent`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add functions/agent-client.mjs agent/test/client.test.mjs
git commit -m "feat: add browser agent client"
```

---

### Task 8: 字节、载荷、hexdump 工具

**Files:**
- Create: `functions/bytes.mjs`
- Create: `functions/payload.mjs`
- Create: `test/bytes.test.mjs`
- Create: `test/payload.test.mjs`

**Interfaces:**
- Consumes: 无
- Produces:
  - `bytes.mjs`: `toHexDump(bytes, {width=16, offset=true})`, `hexToBytes`, `bytesToHex`, `base64ToBytes`, `bytesToBase64`, `utf8ToBytes`, `bytesToUtf8`, `isHex`, `isBase64`
  - `payload.mjs`: `editorToWire({ mode, text, base64, filename }) -> {encoding,data}|null`；`wireToEditor(payload) -> {mode,text,base64}`；`MAX_PAYLOAD_BYTES = 16 * 1024 * 1024`

- [ ] **Step 1: 写字节失败测试**

`test/bytes.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { toHexDump, hexToBytes, bytesToBase64, isHex } from "../functions/bytes.mjs"

test("hexdump has offsets and grouped bytes", () => {
  const dump = toHexDump(new Uint8Array([0x00, 0x41, 0xff]), { width: 4 })
  assert.match(dump, /^00000000\s+00 41 ff/)
})

test("hex validation and conversion", () => {
  assert.equal(isHex("4869"), true)
  assert.equal(isHex("4g"), false)
  assert.deepEqual([...hexToBytes("4869")], [0x48, 0x69])
  assert.equal(bytesToBase64(new Uint8Array([0x48, 0x69])), "SGk=")
})
```

- [ ] **Step 2: 写载荷失败测试**

`test/payload.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { editorToWire, wireToEditor, MAX_PAYLOAD_BYTES } from "../functions/payload.mjs"

test("maps editor modes to wire encodings", () => {
  assert.deepEqual(editorToWire({ mode: "text", text: "hi" }), { encoding: "utf8", data: "hi" })
  assert.deepEqual(editorToWire({ mode: "json", text: "{}" }), { encoding: "utf8", data: "{}" })
  assert.deepEqual(editorToWire({ mode: "hex", text: "4869" }), { encoding: "base64", data: "SGk=" })
  assert.deepEqual(editorToWire({ mode: "base64", base64: "SGk=" }), { encoding: "base64", data: "SGk=" })
  assert.equal(editorToWire({ mode: "none" }), null)
})

test("rejects invalid and oversized payloads", () => {
  assert.throws(() => editorToWire({ mode: "hex", text: "zz" }), /invalid hex/i)
  assert.throws(() => editorToWire({ mode: "base64", base64: "!!!" }), /invalid base64/i)
  const big = "a".repeat(MAX_PAYLOAD_BYTES + 1)
  assert.throws(() => editorToWire({ mode: "text", text: big }), /too large/i)
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL，找不到模块

- [ ] **Step 4: 实现两个模块**

`functions/bytes.mjs` 与 `functions/payload.mjs` 按签名实现。hexdump 每行：8 位十六进制偏移 + 两空格 + 每字节两位十六进制（可选用 `|ascii|`），宽度默认 16。`editorToWire` 先算字节数再比较上限。`wireToEditor` 把 `utf8` 还原为 `text`，`base64` 还原为 `hex` 文本（默认 hex 展示）。

- [ ] **Step 5: 运行测试确认通过**

Run: `npm run test:unit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/bytes.mjs functions/payload.mjs test/bytes.test.mjs test/payload.test.mjs package.json
git commit -m "feat: add byte and payload utilities"
```

---

### Task 9: 协议注册表与契约测试

**Files:**
- Create: `protocols/registry.mjs`
- Create: `test/registry.test.mjs`
- Modify: `agent/adapters/index.js`（确保导出 `tcp`、`udp`）

**Interfaces:**
- Consumes: 适配器注册表
- Produces: `GROUPS`、`protocols`、`getProtocol(id)`；本阶段两个条目

- [ ] **Step 1: 写注册表失败测试**

`test/registry.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { GROUPS, protocols, getProtocol } from "../protocols/registry.mjs"
const require = createRequire(import.meta.url)
const adapters = require("../agent/adapters/index.js")

const FIELD_TYPES = new Set(["text","number","password","select","checkbox","textarea","keyvalue","timer"])
const PANELS = new Set([null,"hls","webrtc","stomp","xmpp","sip","mcp","a2a","webhooks"])

test("registry is internally consistent", () => {
  const ids = new Set()
  for (const p of protocols) {
    assert.equal(ids.has(p.id), false, `duplicate id ${p.id}`)
    ids.add(p.id)
    assert.equal(GROUPS.includes(p.group), true, `bad group ${p.group}`)
    assert.ok(["agent","http","browser"].includes(p.transport), `bad transport ${p.id}`)
    assert.ok(PANELS.has(p.panel), `bad panel ${p.id}`)
    for (const f of p.fields) {
      assert.ok(f.key && f.label, `field missing key/label in ${p.id}`)
      assert.equal(FIELD_TYPES.has(f.type), true, `bad field type ${f.type} in ${p.id}`)
      if (f.type === "select") assert.ok(Array.isArray(f.options) && f.options.length > 0)
    }
    if (p.transport === "agent") assert.ok(adapters[p.id], `missing adapter for ${p.id}`)
    if (p.transport === "http") assert.equal(typeof p.buildRequest, "function", `missing builder for ${p.id}`)
  }
})

test("lookup returns a descriptor", () => {
  assert.equal(getProtocol("tcp").id, "tcp")
  assert.equal(getProtocol("missing"), undefined)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL，找不到 `protocols/registry.mjs`

- [ ] **Step 3: 实现注册表**

`protocols/registry.mjs` 先只包含 `tcp`、`udp`：

```js
{
  id: "tcp", label: "TCP", group: "Raw & Streaming", transport: "agent",
  fields: [
    { key: "host", label: "Host", type: "text", default: "127.0.0.1", required: true },
    { key: "port", label: "Port", type: "number", default: 9000, required: true },
    { key: "encoding", label: "Receive as", type: "select", options: ["base64","utf8"], default: "base64" },
  ],
  payload: "binary", actions: ["connect","send","close"], panel: null, agentFallback: false, buildRequest: null,
}
```

UDP 额外字段 `bindPort`（number，默认 0）。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test:unit && npm run test:agent`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add protocols/registry.mjs test/registry.test.mjs agent/adapters/index.js
git commit -m "feat: add protocol registry contract"
```

---

### Task 10: 载荷编辑器与协议日志组件

**Files:**
- Create: `components/protocols/payload.vue`
- Create: `components/protocols/log.vue`
- Modify: `lang/en-US.json`（新增本任务所需键：`payload`, `hex`, `text`, `file`, `clear_log`, `bytes`）

**Interfaces:**
- Consumes: `functions/payload.mjs`、`functions/bytes.mjs`
- Produces:
  - `payload.vue` props `{ value: Object, modes: string[], label: string }`，`input` 事件值 `{ mode, text, base64, filename }`
  - `log.vue` props `{ entries: Array }`；entry `{ ts, direction, encoding, data, bytes }`

- [ ] **Step 1: 实现载荷编辑器**

`payload.vue` 要点：

- 模式选择（传入的 `modes`）；`text/json/xml` 用 `<textarea>`；`hex` 用 `<textarea>` 并实时显示字节数/非法提示；`base64` 用 `<textarea>`；`file` 用 `<input type="file">` + `FileReader.readAsDataURL` 提取 base64。
- 所有修改 `emit("input", value)`。
- 超过 16 MiB 显示错误并阻止发送（`MAX_PAYLOAD_BYTES`）。
- 复用现有表单样式（`<ul><li><label>...`），不新增全局 CSS。

- [ ] **Step 2: 实现日志组件**

`log.vue` 要点：

- 顶部工具条：文本/Hex 切换、清空（`emit("clear")`）。
- 每条：时间 `toLocaleTimeString()`、方向前缀（sent/received/info/error）、内容。
- `encoding === "base64"` 时：文本模式尝试 `bytesToUtf8`（不可打印则显示提示），Hex 模式用 `toHexDump`。
- 自动滚动到底部；最多显示最后 2000 条。

- [ ] **Step 3: 加文案并检查构建**

Run: `npm run generate`
Expected: 退出码 0，无 Vue 模板编译错误

- [ ] **Step 4: Commit**

```bash
git add components/protocols/payload.vue components/protocols/log.vue lang/en-US.json
git commit -m "feat(ui): add payload editor and protocol log"
```

---

### Task 11: 通用实验台 `lab.vue`

**Files:**
- Create: `components/protocols/lab.vue`
- Create: `functions/http-normalize.mjs`
- Create: `functions/http-request.js`
- Create: `test/http-normalize.test.mjs`

**Interfaces:**
- Consumes: 注册表、AgentClient、payload/log 组件、`sendNetworkRequest`
- Produces:
  - `lab.vue` props `{ protocol: Object }`
  - `normalizeResponse(raw) -> { status, headers, data }`
  - `sendHttp(req, store) -> Promise<{ status, headers, data }>`

- [ ] **Step 1: 写响应归一化失败测试**

`test/http-normalize.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { normalizeResponse } from "../functions/http-normalize.mjs"

test("normalizes axios and extension response shapes", () => {
  assert.deepEqual(normalizeResponse({ status: 200, headers: { a: "b" }, data: "ok" }), { status: 200, headers: { a: "b" }, data: "ok" })
  assert.deepEqual(normalizeResponse("raw"), { status: 200, headers: {}, data: "raw" })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL，找不到 `functions/http-normalize.mjs`

- [ ] **Step 3: 实现归一化与薄封装**

`functions/http-normalize.mjs`：若 `raw` 是对象且 `raw.data !== undefined`，返回 `{ status: raw.status, headers: raw.headers || {}, data: raw.data }`；否则 `{ status: 200, headers: {}, data: raw }`。

`functions/http-request.js`：

```js
import { sendNetworkRequest } from "./network"
import { normalizeResponse } from "./http-normalize.mjs"
export async function sendHttp(req, store) {
  return normalizeResponse(await sendNetworkRequest(req, store))
}
```

- [ ] **Step 4: 实现 `lab.vue`**

要点：

- 顶部：协议名、传输标签（Browser/HTTP/Agent）、Agent 状态（从 `agentClient` 监听 `status`）。
- 字段渲染：`text/number/password/textarea/select/checkbox/keyvalue/timer`；`keyvalue` 渲染为可增删的 key/value 行，输出对象。
- 载荷：`protocol.payload !== "none"` 时渲染 `payload.vue`，模式按 `payload` 映射（`binary` → `["hex","base64","file"]`，`text` → `["text"]`，`json` → `["json","text"]`，`xml` → `["xml","text"]`）。
- 动作：
  - `agent`：`connect` → `agentClient.open(protocol.id, fields)`，保存 `sessionId`，把 `payload` 作为第一条 log；`send` → `agentClient.send(sessionId, editorToWire(payload))`；`close` → `agentClient.close`。
  - `http`：`send` → 由 `buildRequest(fields, wire)` 构造请求并 `sendHttp`；把 status/headers/body 写入日志。
  - `browser`：动态渲染 `panels/<panel>.vue`，传入 `protocol` 与 `fields`。
- 未连接 Agent 时禁用需要 Agent 的动作，并显示 `agent_offline_hint`。
- 监听 `session` 事件：只处理当前 `sessionId`；`data` 追加日志，`error` 追加错误，`closed` 置为未连接。
- `beforeDestroy` 关闭当前会话。

- [ ] **Step 5: 构建检查**

Run: `npm run generate`
Expected: 退出码 0

- [ ] **Step 6: Commit**

```bash
git add components/protocols/lab.vue functions/http-normalize.mjs functions/http-request.js test/http-normalize.test.mjs
git commit -m "feat(ui): add generic protocol lab"
```

---

### Task 12: `/protocols` 页面、导航、i18n、sitemap

**Files:**
- Create: `pages/protocols.vue`
- Modify: `components/layout/sidenav.vue`
- Modify: `nuxt.config.js`（`sitemapPages` 增加 `/protocols`）
- Modify: `lang/en-US.json`（`protocols`, `protocol_lab`, `agent_offline_hint`, `agent_required`, `start_agent_command`）
- Create: `tests/protocols.spec.js`

**Interfaces:**
- Consumes: `protocols/registry.mjs`、`lab.vue`
- Produces: `/protocols` 路由；侧边栏入口

- [ ] **Step 1: 实现页面**

`pages/protocols.vue`：

- 顶部 Agent 状态条：`agentClient.status`，未连接时显示 `npx postwoman-agent`/`npm run agent` 提示。
- 左侧按 `GROUPS` 分组列出协议按钮；选中项高亮。
- 右侧渲染 `<lab :protocol="selected" />`。
- 默认选中 `protocols[0]`；`mounted` 时监听 `status` 事件，`beforeDestroy` 移除。
- 复用 `pw-section` 样式；不新增全局 CSS。

- [ ] **Step 2: 加入导航与 sitemap**

`sidenav.vue` 在 realtime 链接后增加：

```html
<nuxt-link :to="localePath('protocols')" :class="linkActive('/protocols')" v-tooltip.right="$t('protocols')" :aria-label="$t('protocols')">
  <i class="material-icons">lan</i>
</nuxt-link>
```

`nuxt.config.js`：`const sitemapPages = ["", "/doc", "/graphql", "/realtime", "/settings", "/protocols"]`。

- [ ] **Step 3: 写 Cypress 失败测试**

`tests/protocols.spec.js`：

```js
describe("Protocol Lab", () => {
  it("lists protocols and shows the agent offline hint", () => {
    cy.visit("/protocols")
    cy.contains("TCP")
    cy.contains("UDP")
    cy.contains(/agent/i)
  })

  it("selects a protocol and renders its fields", () => {
    cy.visit("/protocols")
    cy.contains("TCP").click()
    cy.get("input").should("have.length.at.least", 2)
  })
})
```

- [ ] **Step 4: 运行 e2e 确认失败**

Run: `npm run dev` 另开终端，然后 `npx cypress run --spec tests/protocols.spec.js`
Expected: FAIL（页面/导航/设置区块尚不存在）

- [ ] **Step 5: 运行构建与 e2e**

Run: `npm run generate && npx cypress run`
Expected: 现有 11 个 + 新增 2 个全部通过

- [ ] **Step 6: Commit**

```bash
git add pages/protocols.vue components/layout/sidenav.vue nuxt.config.js lang/en-US.json tests/protocols.spec.js
git commit -m "feat: add protocols page and navigation"
```

---

### Task 13: 设置页 Local Agent 区块

**Files:**
- Modify: `pages/settings.vue`
- Modify: `tests/protocols.spec.js`
- Modify: `lang/en-US.json`（`local_agent`, `agent_url`, `agent_token`, `agent_connect`, `agent_disconnect`, `agent_connected`, `agent_disconnected`, `agent_permission_hint`）

**Interfaces:**
- Consumes: `agentClient`
- Produces: 设置页可连接/断开 Agent；URL 存 `localStorage`，token 存 `sessionStorage`

- [ ] **Step 1: 增加区块**

在 proxy 区块后加一个 `pw-section`（`id="agent"`）：

- URL 输入（默认 `ws://127.0.0.1:3567/agent`）
- token 密码输入
- 连接/断开按钮；状态文字
- Chrome/Edge 授权提示文案

- [ ] **Step 2: 接线**

- `mounted()` 读取 `localStorage.getItem("postwoman.agent.url")` 与 `sessionStorage.getItem("postwoman.agent.token")`（SSR 安全：只在 mounted）。
- 连接：`await agentClient.connect(url, token)`；成功后写回 localStorage/sessionStorage；失败 toast。
- 断开：`agentClient.disconnect()`。
- 监听 `status` 事件更新状态；`beforeDestroy` 移除监听。
- 不把 token 写 Vuex、不写 localStorage。

- [ ] **Step 3: 增加设置页 Cypress 用例并运行**

在 `tests/protocols.spec.js` 增加：

```js
it("shows the local agent section in settings", () => {
  cy.visit("/settings")
  cy.contains(/local agent/i)
  cy.get('input[type="password"]').should("have.length.at.least", 1)
})
```

Run: `npx cypress run --spec tests/protocols.spec.js`
Expected: 设置页用例通过

- [ ] **Step 4: Commit**

```bash
git add pages/settings.vue lang/en-US.json
git commit -m "feat: add local agent settings"
```

---

### Task 14: README 与阶段验收

**Files:**
- Modify: `README.md`（新增 Protocol Lab 与 Agent 章节）
- Create: `docs/protocol-lab.md`（协议清单、子集说明、手工验证步骤）

**Interfaces:**
- Consumes: 前 13 个任务
- Produces: 可交付的阶段 0

- [ ] **Step 1: 写文档**

README 增加：`npm --prefix agent install`、`npm run agent`、token 粘贴、Chrome/Edge 本地网络访问授权、Safari 不支持、安全边界（只监听本机）。
`docs/protocol-lab.md` 增加：TCP/UDP 字段说明、编码模式、测试方法。

- [ ] **Step 2: 跑完整验收**

```bash
npm run test:unit
npm run test:agent
npm run generate
npx cypress run
```

Expected: 全部通过。

- [ ] **Step 3: 手工端到端验收**

1. 终端 A：`npm run agent`，记录 token。
2. 终端 B：`npx http-server` 或 `npm run dev`，打开 `/protocols`。
3. 设置页填入 token，连接成功。首次连接时确认 Chrome/Edge 弹出「本地网络访问」授权；拒绝后状态条应给出可操作提示。
4. TCP：用 `node -e "require('net').createServer(s=>s.pipe(s)).listen(9000)"` 起 echo；连接、发送 `hello`，日志出现收到 `hello`。
5. UDP：用 `node -e "const d=require('dgram').createSocket('udp4');d.on('message',(m,r)=>d.send(m,r.port,r.address));d.bind(9001)"`；发送后收到回显。
6. 关闭页面，确认 Agent 终端没有残留 socket（可选：`ss -tanp | grep 9000`）。

- [ ] **Step 4: Commit**

```bash
git add README.md docs/protocol-lab.md
git commit -m "docs: document protocol lab and local agent"
```

## 阶段 0 完成标准

- TCP/UDP 在 Chrome/Edge 中经本地 Agent 端到端收发。
- 错误 token、非白名单 Origin 被拒绝。
- 页面断开后 Agent 无残留会话。
- `npm run test:unit`、`npm run test:agent`、`npm run generate`、Cypress 全绿。
- 现有 REST/GraphQL/WebSocket/SSE/Socket.IO/MQTT 行为未变。
