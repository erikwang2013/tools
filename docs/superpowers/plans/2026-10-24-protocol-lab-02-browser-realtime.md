# Protocol Lab 阶段 2：浏览器实时协议实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 STOMP (WebSocket)、XMPP (WebSocket)、SIP (WebSocket) 三个条目，并提供 Agent WS 桥接作为 CORS/Origin 失败时的回退。

**Architecture:** 三个协议都在浏览器用各自客户端库实现，动态加载。Agent 新增通用 `ws-bridge` 适配器：页面先登记目标 WS 与 headers，拿到一次性本地 URL，客户端库连本地桥，Agent 双向转发帧。

**Tech Stack:** `@stomp/stompjs`、`@xmpp/client`、`sip.js`、Node `ws`、`node:test`、Cypress。

**Spec:** `docs/superpowers/specs/2026-10-24-protocol-lab-design.md`
**共享契约:** `docs/superpowers/plans/2026-10-24-protocol-lab-index.md`
**前置:** 阶段 0、1 全部任务通过

## Global Constraints

- 沿用阶段 0/1 的全部约束。
- 三个客户端库必须动态 `import()`，不进入首屏 bundle。
- Agent 桥的本地 URL 含一次性随机路径；升级时仍校验 Origin 白名单。
- 二进制帧按字节转发，不做 base64 转换（浏览器库与 Agent 之间是原始 WS 帧）。
- 不实现 STOMP 事务、XMPP MUC、SIP 媒体/INVITE；只做调试所需子集。
- 日志最多 2000 条；单条消息上限 16 MiB。

## Review Focus

1. 远端 WS 拒绝 Origin 或被 CORS/网络拦截：页面给出明确错误，Agent 桥可重试成功（Task 1、Task 2）。
2. STOMP 二进制 body 必须逐字节保持（Task 2 的桥测试 + 手工验收）。
3. XMPP/SIP 认证失败：显示服务端错误、关闭 socket、不进入自动重连循环（Task 3、Task 4 的手工验收；UI 错误状态由 Cypress 覆盖）。
4. 桥目标关闭或 Agent 退出：页面收到 close，可重新连接，Agent 无残留上游 socket（Task 1）。
5. 接近 16 MiB 的帧可通过，超过上限被拒绝且页面不崩溃（Task 1 的边界测试）。

---

### Task 1: Agent WS 桥接适配器

**Files:**
- Create: `agent/adapters/ws-bridge.js`
- Create: `agent/lib/ws-bridge.js`
- Create: `agent/test/ws-bridge.test.js`
- Modify: `agent/lib/server.js`（upgrade 路由区分 `/agent` 与 `/bridge/<secret>`）
- Modify: `agent/adapters/index.js`
- Modify: `functions/agent-client.mjs`（无改动则跳过）

**Interfaces:**
- Consumes: `ws`、Origin 白名单
- Produces:
  - 适配器 `ws-bridge`；config `{ targetUrl, headers?, subprotocols?, allowSelfSigned? }`
  - `ready: { url: "ws://127.0.0.1:<port>/bridge/<secret>" }`
  - `agent/lib/ws-bridge.js`: `createBridgeRegistry({ getPort, isAllowedOrigin })`，提供 `register(upstreamConfig) -> { secret, url }`、`unregister(secret)`、`handleUpgrade(req, socket, head)`；`getPort()` 返回服务器实际端口（`server.address().port`）

- [ ] **Step 1: 写桥接失败测试**

`agent/test/ws-bridge.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const { WebSocketServer } = require("ws")
const { createAgentServer } = require("../lib/server")
const WebSocket = require("ws")

test("bridges text and binary frames and cleans up", async () => {
  const upstream = new WebSocketServer({ port: 0 })
  upstream.on("connection", ws => ws.on("message", (data, isBinary) => ws.send(data, { binary: isBinary })))
  await new Promise(r => upstream.once("listening", r))
  const targetUrl = `ws://127.0.0.1:${upstream.address().port}`
  const srv = await createAgentServer({ port: 0, token: "t", origins: [], allowNoOrigin: true, adapters: require("../adapters") })
  const agent = new WebSocket(`ws://127.0.0.1:${srv.port}/agent`)
  const msgs = []
  await new Promise((resolve, reject) => {
    agent.on("open", () => agent.send(JSON.stringify({ v: 1, type: "auth", token: "t" })))
    agent.on("message", raw => {
      const msg = JSON.parse(raw)
      msgs.push(msg)
      if (msg.type === "auth:ok") agent.send(JSON.stringify({ v: 1, type: "open", id: "b1", protocol: "ws-bridge", config: { targetUrl } }))
      if (msg.type === "ready") resolve()
    })
    agent.on("error", reject)
  })
  const ready = msgs.find(m => m.type === "ready")
  const bridge = new WebSocket(ready.payload.url)
  await new Promise((resolve, reject) => { bridge.on("open", resolve); bridge.on("error", reject) })
  const echoed = new Promise(resolve => bridge.on("message", (data, isBinary) => resolve({ data, isBinary })))
  bridge.send("hi")
  assert.deepEqual(await echoed, { data: Buffer.from("hi"), isBinary: false })
  const echoedBin = new Promise(resolve => bridge.on("message", (data, isBinary) => resolve({ data, isBinary })))
  bridge.send(Buffer.from([0, 1, 255]), { binary: true })
  assert.deepEqual(await echoedBin, { data: Buffer.from([0, 1, 255]), isBinary: true })
  bridge.close(); agent.close()
  await srv.close(); await new Promise(r => upstream.close(r))
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，未知协议 `ws-bridge`

- [ ] **Step 3: 实现桥接注册表**

`agent/lib/ws-bridge.js`：

- `register({ targetUrl, headers, subprotocols, allowSelfSigned })`：生成 16 字节随机 secret；用 `new WebSocket(targetUrl, subprotocols, { headers, rejectUnauthorized: !allowSelfSigned })` 连接上游；连接成功后返回 `{ secret, url }`，失败抛错并清理。
- `handleUpgrade(req, socket, head)`：解析 `/bridge/<secret>`；校验 Origin；找不到 secret 返回 403；`wss.handleUpgrade` 后用 `bridgeSockets` 双向转发：
  - 浏览器 → 上游：`browser.on("message", (data, isBinary) => upstream.send(data, { binary: isBinary }))`
  - 上游 → 浏览器：反向同理
  - 任一端 close → 关闭另一端；`unregister(secret)`。
- 每端 `maxPayload: 16 MiB`。
- `unregister` 幂等。

- [ ] **Step 4: 接入服务器与适配器**

`agent/lib/server.js`：把 `upgrade` 先交给 `bridgeRegistry.handleUpgrade`；不匹配再走 `/agent` 的 JSON 信封。`createAgentServer` 创建 `bridgeRegistry` 并放入 `context.bridgeRegistry`。
`agent/adapters/ws-bridge.js`：`create(config, emit, context)` 调 `context.bridgeRegistry.register(config)`，返回 `ready: { url }`；`send` 不需要（帧走桥，不走信封）；`close()` 调 `unregister`；桥关闭时 emit `closed`。
`adapters/index.js` 注册。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent`
Expected: PASS（文本、二进制、清理）

- [ ] **Step 6: Commit**

```bash
git add agent/adapters/ws-bridge.js agent/lib/ws-bridge.js agent/lib/server.js agent/adapters/index.js agent/test/ws-bridge.test.js
git commit -m "feat(agent): add websocket bridge"
```

---

### Task 2: STOMP (WebSocket) 面板

**Files:**
- Create: `components/protocols/panels/stomp.vue`
- Create: `functions/stomp-panel.mjs`（纯辅助：帧日志格式化、transport 选择）
- Create: `test/stomp-panel.test.mjs`
- Modify: `protocols/registry.mjs`（`stomp-ws`）
- Modify: `package.json`（`@stomp/stompjs`）
- Modify: `lang/en-US.json`（`subscribe_destination`, `send_destination`, `connect_headers`）
- Create: `tests/stomp.spec.js`

**Interfaces:**
- Consumes: `@stomp/stompjs`（动态 import）、`agentClient`
- Produces: `stomp-ws` 条目：`transport:"browser"`, `panel:"stomp"`, `agentFallback:true`
  - `formatFrameLog(frame) -> string`
  - `resolveBrokerUrl({ mode, brokerUrl, bridgeUrl }) -> string`

- [ ] **Step 1: 安装依赖**

Run: `npm install @stomp/stompjs@^7`

- [ ] **Step 2: 写纯辅助失败测试**

`test/stomp-panel.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { formatFrameLog, resolveBrokerUrl } from "../functions/stomp-panel.mjs"

test("direct mode keeps the broker url", () => {
  assert.equal(resolveBrokerUrl({ mode: "direct", brokerUrl: "wss://b.test/ws", bridgeUrl: "" }), "wss://b.test/ws")
})

test("agent mode requires a bridge url", () => {
  assert.equal(resolveBrokerUrl({ mode: "agent", brokerUrl: "wss://b.test/ws", bridgeUrl: "ws://127.0.0.1:1/bridge/x" }), "ws://127.0.0.1:1/bridge/x")
  assert.throws(() => resolveBrokerUrl({ mode: "agent", brokerUrl: "wss://b.test/ws", bridgeUrl: "" }), /bridge/i)
})

test("frame log includes command and headers", () => {
  assert.match(formatFrameLog({ command: "MESSAGE", headers: { destination: "/q" }, body: "hi" }), /MESSAGE[\s\S]*destination: \/q[\s\S]*hi/)
})
```

- [ ] **Step 3: 实现面板**

字段：

- transport: `direct` / `agent`（select）
- broker URL（`wss://.../ws`）
- connect headers（keyvalue）
- subscribe destination
- send destination
- payload（binary）

行为：

- direct：动态 `import("@stomp/stompjs")`，`new Client({ brokerURL, connectHeaders, reconnectDelay: 0, onConnect, onStompError, onWebSocketError, onWebSocketClose })`。
- agent：先 `agentClient.open("ws-bridge", { targetUrl: brokerUrl, headers: connectHeaders })`，拿 `payload.url`，再把 `brokerURL` 设为该本地 URL；关闭时 `agentClient.close(sessionId)`。
- connect → activate；subscribe → `client.subscribe(destination, msg => log)`；send → `client.publish({ destination, body, binaryBody })`；disconnect → `client.deactivate()`。
- 二进制：payload 编辑器 hex/base64 转 `Uint8Array`，用 `binaryBody`；接收 `msg.binaryBody` 按 hex 展示。
- `beforeDestroy`：deactivate + 关闭 agent 会话。
- 不实现事务、receipts（日志照常显示）。

registry `stomp-ws`：fields `transport`、`brokerUrl`、`connectHeaders`、`subscribeDestination`、`sendDestination`；payload `binary`；panel `stomp`。

- [ ] **Step 4: 写 Cypress 失败测试**

`tests/stomp.spec.js`：访问 `/protocols`，选择 STOMP，断言字段存在；不连接时 send 禁用；切换到 `agent` 模式且 Agent 离线时显示提示。

- [ ] **Step 5: 运行测试与构建**

Run: `npm run test:unit && npm run generate && npx cypress run --spec tests/stomp.spec.js`
Expected: PASS

- [ ] **Step 6: 手工验收**

用 Docker 起 `rabbitmq:3-management` 并启用 `rabbitmq_web_stomp`，或本地 `stompjs` 测试 broker；连接、订阅、发送文本与二进制，确认字节一致。

- [ ] **Step 7: Commit**

```bash
git add components/protocols/panels/stomp.vue functions/stomp-panel.mjs test/stomp-panel.test.mjs protocols/registry.mjs package.json package-lock.json lang/en-US.json tests/stomp.spec.js
git commit -m "feat: add stomp websocket panel"
```

---

### Task 3: XMPP (WebSocket) 面板

**Files:**
- Create: `components/protocols/panels/xmpp.vue`
- Create: `functions/xmpp-panel.mjs`
- Create: `test/xmpp-panel.test.mjs`
- Modify: `protocols/registry.mjs`（`xmpp-ws`）
- Modify: `package.json`（`@xmpp/client`）
- Modify: `lang/en-US.json`（`jid`, `password`, `to`, `service_url`）
- Create: `tests/xmpp.spec.js`

**Interfaces:**
- Consumes: `@xmpp/client`（动态 import）、`agentClient`
- Produces: `xmpp-ws` 条目：`transport:"browser"`, `panel:"xmpp"`, `agentFallback:true`
  - `buildMessageStanza({ to, body }) -> { name:"message", attrs:{to}, children:[{name:"body", text:body}] }`
  - `resolveService({ mode, serviceUrl, bridgeUrl }) -> string`

- [ ] **Step 1: 安装依赖**

Run: `npm install @xmpp/client@^0.13`

- [ ] **Step 2: 写纯辅助失败测试**

`test/xmpp-panel.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { buildMessageStanza, resolveService } from "../functions/xmpp-panel.mjs"

test("builds a message stanza", () => {
  assert.deepEqual(buildMessageStanza({ to: "a@b", body: "hi" }), {
    name: "message", attrs: { to: "a@b" }, children: [{ name: "body", text: "hi" }],
  })
})

test("agent mode requires a bridge url", () => {
  assert.equal(resolveService({ mode: "direct", serviceUrl: "wss://x/ws", bridgeUrl: "" }), "wss://x/ws")
  assert.throws(() => resolveService({ mode: "agent", serviceUrl: "wss://x/ws", bridgeUrl: "" }), /bridge/i)
})
```

- [ ] **Step 3: 实现面板**

字段：transport(direct/agent)、service URL（`wss://host:5280/ws`）、JID、密码、收件人 JID、消息文本。

行为：

- direct：`import("@xmpp/client")`，`client({ service: serviceUrl, domain: jidDomain, username, password })`；`client.start()`；监听 `stanza`、`error`、`offline`。
- agent：先开 `ws-bridge`（目标 service URL）拿本地 URL，再作为 `service`。
- 发送：`client.send(xml("message", { to }, xml("body", {}, text)))`。
- 日志：连接状态、收到的 stanza（XML 字符串）、发送结果。
- 认证失败：显示 error，`client.stop()`，不自动重试。
- `beforeDestroy`：stop + 关 agent 会话。

registry `xmpp-ws`：fields `transport`、`serviceUrl`、`jid`、`password`、`to`、`message`；payload `none`；panel `xmpp`。

- [ ] **Step 4: Cypress 与手工验收**

Cypress：字段存在、Agent 离线提示、密码输入类型为 password。
手工：用 Prosody 启用 `websocket` 模块，或公共 XMPP WS 服务；连接、发一条 message 给同一账号。

- [ ] **Step 5: 运行测试与构建**

Run: `npm run test:unit && npm run generate && npx cypress run --spec tests/xmpp.spec.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/protocols/panels/xmpp.vue functions/xmpp-panel.mjs test/xmpp-panel.test.mjs protocols/registry.mjs package.json package-lock.json lang/en-US.json tests/xmpp.spec.js
git commit -m "feat: add xmpp websocket panel"
```

---

### Task 4: SIP (WebSocket) 面板

**Files:**
- Create: `components/protocols/panels/sip.vue`
- Create: `functions/sip-panel.mjs`
- Create: `test/sip-panel.test.mjs`
- Modify: `protocols/registry.mjs`（`sip-ws`）
- Modify: `package.json`（`sip.js`）
- Modify: `lang/en-US.json`（`sip_uri`, `registrar`, `target_uri`）
- Create: `tests/sip.spec.js`

**Interfaces:**
- Consumes: `sip.js`（动态 import）、`agentClient`
- Produces: `sip-ws` 条目：`transport:"browser"`, `panel:"sip"`, `agentFallback:true`
  - `buildSipTarget({ user, domain }) -> "sip:user@domain"`
  - `resolveSipServer({ mode, wsUrl, bridgeUrl }) -> string`

- [ ] **Step 1: 安装依赖**

Run: `npm install sip.js@^0.21`

- [ ] **Step 2: 写纯辅助失败测试**

`test/sip-panel.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { buildSipTarget, resolveSipServer } from "../functions/sip-panel.mjs"

test("builds a sip uri and resolves the server", () => {
  assert.equal(buildSipTarget({ user: "1001", domain: "sip.test" }), "sip:1001@sip.test")
  assert.equal(resolveSipServer({ mode: "direct", wsUrl: "wss://s/ws", bridgeUrl: "" }), "wss://s/ws")
  assert.throws(() => resolveSipServer({ mode: "agent", wsUrl: "wss://s/ws", bridgeUrl: "" }), /bridge/i)
})
```

- [ ] **Step 3: 实现面板**

字段：transport(direct/agent)、WebSocket URL、SIP URI（user@domain）、认证用户名、密码、目标 URI、消息文本。

行为：

- direct：`import("sip.js")`，`new UserAgent({ uri, transportOptions: { server } })`；`userAgent.start()`；`registerer.register()`。
- agent：先开 `ws-bridge`（目标 WS URL，headers 为空）拿本地 URL，再作为 `transportOptions.server`。
- 发送：使用 sip.js 当前版本的消息 API（`UserAgent.sendMessage` 或 `Messenger`，按安装版本选择）；消息体为文本。
- 日志：REGISTER 状态、收到的 MESSAGE、错误。
- 认证失败：显示错误，`userAgent.stop()`，不自动重试。
- 不实现 INVITE、媒体、通话。
- `beforeDestroy`：unregister + stop + 关 agent 会话。

registry `sip-ws`：fields `transport`、`wsUrl`、`sipUri`、`authUser`、`password`、`targetUri`、`message`；payload `none`；panel `sip`。

- [ ] **Step 4: Cypress 与手工验收**

Cypress：字段存在、Agent 离线提示、密码类型。
手工：用 Asterisk/Kamailio 启用 `res_http_websocket`，注册后发 MESSAGE 到另一个账号；记录到 `docs/protocol-lab.md`。

- [ ] **Step 5: 运行测试与构建**

Run: `npm run test:unit && npm run generate && npx cypress run --spec tests/sip.spec.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add components/protocols/panels/sip.vue functions/sip-panel.mjs test/sip-panel.test.mjs protocols/registry.mjs package.json package-lock.json lang/en-US.json tests/sip.spec.js
git commit -m "feat: add sip websocket panel"
```

---

### Task 5: 阶段 2 验收

**Files:**
- Modify: `docs/protocol-lab.md`
- Modify: `README.md`

- [ ] **Step 1: 文档**

写明三个协议的 URL 形态、认证字段、支持的子集、Agent 桥使用方式、本地测试服务（RabbitMQ Web-STOMP、Prosody、Asterisk）。

- [ ] **Step 2: 完整测试**

```bash
npm run test:unit
npm run test:agent
npm run generate
npx cypress run
```

Expected: 全部通过。

- [ ] **Step 3: 手工验收**

1. STOMP：直连，订阅/发送文本与二进制；再经 Agent 桥重复一次。
2. XMPP：直连与桥各连接一次，收发一条 message。
3. SIP：REGISTER 成功、MESSAGE 收发；错误密码时显示服务端错误并停止。
4. 断开 Agent：桥接会话在页面上变为 closed，上游 socket 在 `ss -tanp` 中消失。

- [ ] **Step 4: Commit**

```bash
git add docs/protocol-lab.md README.md
git commit -m "docs: document phase 2 realtime protocols"
```

## 阶段 2 完成标准

- STOMP/XMPP/SIP 直连可用；CORS/Origin 失败时可经 Agent 桥重试。
- 二进制 STOMP body 逐字节一致。
- 认证失败不产生自动重连风暴。
- Agent 无残留上游 socket。
- 构建与所有测试通过。
