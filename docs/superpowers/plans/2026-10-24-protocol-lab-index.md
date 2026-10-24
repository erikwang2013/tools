# Protocol Lab 实施计划索引

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 postwoman.erik.xyz 上新增 39 个协议/能力条目，同时保持现有协议、静态部署和构建链不变。

**Architecture:** 静态 Nuxt 2 页面 + 只监听 `127.0.0.1` 的本地 Agent。页面通过 WebSocket 驱动 Agent；浏览器原生协议直接实现，HTTP 家族复用现有请求链路。所有新条目共用一个注册表驱动的实验台。

**Tech Stack:** Nuxt 2 / Vue 2 / Node 18（页面构建）、Node 18 + CommonJS（Agent）、`node:test`（单元与集成测试）、Cypress 4（e2e）。

**Spec:** `docs/superpowers/specs/2026-10-24-protocol-lab-design.md`

---

## 计划文件与执行顺序

| 顺序 | 计划 | 交付物 | 完成后可用 |
|------|------|--------|------------|
| 0 | `2026-10-24-protocol-lab-00-foundation.md` | Agent 框架、实验台、注册表、TCP/UDP | 本地 Agent 端到端收发 |
| 1 | `2026-10-24-protocol-lab-01-http-and-browser.md` | HTTP 家族、HTTP/2/3、HLS、WebRTC、Webhooks、MCP、A2A、WS 二进制 | 13 个条目 |
| 2 | `2026-10-24-protocol-lab-02-browser-realtime.md` | STOMP/XMPP/SIP（浏览器）+ Agent WS 桥 | 3 个条目 + 回退 |
| 3 | `2026-10-24-protocol-lab-03-raw-and-streaming.md` | Raw Socket、UDS、RTSP、RTMP、RTP/RTCP、ISO 8583 | 7 个条目 |
| 4 | `2026-10-24-protocol-lab-04-rpc-and-messaging.md` | gRPC、Dubbo、Thrift、Hessian、AMQP、Kafka、STOMP-TCP | 7 个条目 |
| 5 | `2026-10-24-protocol-lab-05-iot-industrial.md` | CoAP、LwM2M、OPC UA、Modbus、DNP3、IEC 104、BACnet | 7 个条目 |

阶段 0 是 1–5 的前置。阶段 1 完成后，阶段 2–5 可由不同执行者并行；同一时间只改各自计划列出的文件。
每个阶段结束必须通过该计划的验收任务，并回归阶段 0 的测试。

## 共享契约（所有阶段必须遵守）

### 1. 消息信封

Agent WebSocket 路径固定为 `ws://127.0.0.1:<port>/agent`。所有消息是 JSON 文本，`v` 必须为 `1`。

页面 → Agent：

```js
{ v: 1, type: "auth", token: "<string>" }
{ v: 1, type: "open", id: "<sessionId>", protocol: "<adapterId>", config: { ... } }
{ v: 1, type: "send", id: "<sessionId>", payload: { encoding: "utf8" | "base64", data: "<string>" } }
{ v: 1, type: "close", id: "<sessionId>" }
```

Agent → 页面：

```js
{ v: 1, type: "auth:ok" }
{ v: 1, type: "auth:fail", error: "<message>" }
{ v: 1, type: "ready", id: "<sessionId>", payload: { ... } }   // payload 可为 {}
{ v: 1, type: "log", id: "<sessionId>", payload: { level: "info"|"warn"|"error", message: "<string>" } }
{ v: 1, type: "data", id: "<sessionId>", payload: { encoding: "utf8"|"base64", data: "<string>", bytes: <number>, remote?: "<string>" } }
{ v: 1, type: "error", id: "<sessionId>", payload: { message: "<string>", code?: "<string>" } }
{ v: 1, type: "closed", id: "<sessionId>", payload: { reason: "<string>" } }
```

- 鉴权前只接受 `auth`；任何其他消息立即关闭连接。
- `id` 由页面生成，格式 `${Date.now().toString(36)}-${counter}`。
- 单条消息上限 16 MiB；每页最多 32 个会话。
- `open` 建立超时 30 秒。已建立的会话不会因空闲被回收。
- Agent 每 30 秒发 WS ping；60 秒无 pong 则回收该页全部会话。
- 页面 WS 关闭时，Agent 调用每个会话的 `close()` 并清空 Map。

### 2. 载荷表示

线上只有两种编码：`utf8` 与 `base64`。二进制一律 base64。页面上的 Hex/文件/JSON/XML 模式只是编辑器表现，进入 `functions/payload.mjs` 后统一转换。

### 3. Agent 适配器接口

每个适配器是 `agent/adapters/<id>.js`（CommonJS），并在 `agent/adapters/index.js` 注册：

```js
module.exports = {
  id: "tcp",
  /**
   * @param {object} config  页面提交的字段值
   * @param {(event: {type:"log"|"data"|"error"|"closed", payload: object}) => void} emit
   * @param {{ port:number, hookRouter:object, bridgeRegistry:object, mcpServers:object }} context
   * @returns {Promise<{ send(payload: {encoding:"utf8"|"base64", data:string}): Promise<void>|void,
   *                     close(): void,
   *                     ready?: object }>}
   */
  async create(config, emit, context) { ... },
}
```

- `context` 由服务器注入：`port` 是实际监听端口，`hookRouter` 用于 Webhooks，`bridgeRegistry` 用于 WS 桥，`mcpServers` 是启动配置。普通网络适配器忽略它。
- 会话管理器：`new SessionManager({ adapters, emit, context, maxSessions = 32, openTimeoutMs = 30000 })`；`open(id, protocol, config)` 返回 `{ ready }`；`send`、`close`、`closeAll`。它把 `context` 透传给 `adapter.create(config, emit, context)`。
- `emit` 的 `data.payload` 必须符合上面的 `data` 载荷形状（含 `bytes`）。
- `close()` 必须幂等，并清理定时器、socket、订阅。
- 连接失败时 `create` 抛出 `Error`；会话管理器把它转成一次 `error` 后发 `closed`。
- 适配器不写磁盘、不读页面传来的文件路径。

### 4. 协议注册表

`protocols/registry.mjs`：

```js
export const GROUPS = ["HTTP", "Browser Realtime", "Raw & Streaming", "RPC & Messaging", "IoT / Industrial", "Agent"]

export const protocols = [
  {
    id: "tcp",
    label: "TCP",
    group: "Raw & Streaming",
    transport: "agent",          // "agent" | "http" | "browser"
    fields: [
      { key: "host", label: "Host", type: "text", default: "127.0.0.1", required: true },
    ],
    payload: "binary",           // "none" | "text" | "json" | "xml" | "binary"
    actions: ["connect", "send", "close"],
    panel: null,                 // "hls"|"webrtc"|"stomp"|"xmpp"|"sip"|"mcp"|"a2a"|"webhooks"|null
    agentFallback: false,
    buildRequest: null,          // transport === "http" 时必填
  },
]

export function getProtocol(id) { ... }
```

字段类型必须来自：`text`、`number`、`password`、`select`、`checkbox`、`textarea`、`keyvalue`、`timer`。
`select` 必须有 `options`。`transport === "agent"` 时 `id` 必须与适配器注册表的键一致。
`transport === "http"` 时 `buildRequest(fields, payload)` 返回：

```js
{ method: "GET"|"POST"|"PUT"|"PATCH"|"DELETE"|"HEAD"|"OPTIONS",
  url: "<absolute url>",
  headers: { [name]: string },
  data?: string | Uint8Array,
  responseType?: "arraybuffer" }
```

### 5. 浏览器 AgentClient

`functions/agent-client.mjs`（ESM，可在 Node 测试中注入 `ws` 的 WebSocket）：

```js
export class AgentClient extends EventTarget {
  constructor({ WebSocketImpl = globalThis.WebSocket, timeoutMs = 30000 } = {})
  get status()                  // "disconnected" | "connecting" | "connected" | "error"
  async connect(url, token)     // 解析于 auth:ok
  disconnect()
  async open(protocol, config)  // -> { sessionId: string, payload: object }
  async send(sessionId, payload)
  async close(sessionId)
}
export const agentClient = new AgentClient()
```

事件：

- `status`：`detail = { status, error? }`
- `session`：`detail = { sessionId, type, payload }`，其中 `type` 是 `log|data|error|closed`

### 6. Agent 本地 HTTP 端点

与 WebSocket 同端口：

| 端点 | 用途 | 鉴权 |
|------|------|------|
| `POST /proxy/http` | 浏览器直连失败时的 HTTP 回退 | `X-Agent-Token` 头 |
| `ANY /hook/<secret>` | Webhooks 入站 | 随机路径 |
| `GET /health` | 存活检查 | 无 |

`/proxy/http` 请求体 `{ method, url, headers, data, encoding }`，响应 `{ status, headers, data, encoding }`。
只对白名单 Origin 返回 CORS 头；`OPTIONS` 预检必须通过。

### 7. 目录与文件职责

```
agent/
  package.json          Agent 独立依赖与脚本
  index.js              仅负责启动、打印 URL/token
  config.example.json   MCP stdio server 白名单示例
  lib/server.js         HTTP + WS 服务、鉴权、Origin、ping
  lib/session.js        会话生命周期
  lib/envelope.js       信封编解码与校验
  lib/origin.js         Origin 白名单
  lib/payload.js        utf8/base64 <-> Buffer
  lib/http-proxy.js     /proxy/http 实现
  lib/hooks.js          Webhooks 入站路由
  adapters/index.js     适配器注册表
  adapters/<proto>.js   每个协议一个
  test/*.test.js        node:test
protocols/
  registry.mjs          协议描述表（唯一事实来源）
  builders.mjs          HTTP 家族的 buildRequest 纯函数
components/protocols/
  lab.vue               通用实验台
  payload.vue           载荷编辑器
  log.vue               文本/hex 日志
  panels/*.vue          专属面板
pages/protocols.vue
functions/
  agent-client.mjs      AgentClient
  payload.mjs           载荷转换与校验
  bytes.mjs             hexdump/base64/utf8
  http-normalize.mjs    响应归一化
  http-request.js       薄封装 sendNetworkRequest
  a2a.mjs               A2A 客户端
  mcp-remote.mjs        MCP Streamable HTTP/SSE 客户端
test/
  *.test.mjs            Node 单元测试（纯模块）
```

### 8. 命令

```bash
npm --prefix agent install        # 安装 Agent 依赖
npm run agent                     # 启动 Agent（默认 127.0.0.1:3567）
npm run test:unit                 # node --test test
npm run test:agent                # npm --prefix agent test
npm run generate                  # Nuxt 静态构建
npx cypress run                   # 现有 e2e + 新增 e2e
```

根 `package.json` 需要新增：

```json
"agent": "node agent/index.js",
"test:unit": "node --test test",
"test:agent": "npm --prefix agent test"
```

## Global Constraints

- Agent 构建与运行只用 Node 18；不引入 Node 20 专有 API。
- Agent 只绑定 `127.0.0.1`；默认端口 3567；token 每次启动随机生成。
- 默认允许的 Origin：`https://postwoman.erik.xyz`、`http://localhost:3000`、`http://127.0.0.1:3000`。其他 Origin 一律拒绝。
- 单条消息 16 MiB；每页最多 32 个会话；`open` 超时 30 秒；已建立会话不因空闲回收；ping 30 秒、60 秒无 pong 回收。
- 页面永远不向 Agent 传文件路径；文件在浏览器内读取后按字节发送。
- MCP stdio 只能启动 `agent/config.json` 中已配置的 server；页面只能选择，不能提交命令。
- 新协议不接入集合、历史、环境变量、前置脚本；刷新后配置不保留。
- 协议名保持英文；新增通用 UI 文案只写 `lang/en-US.json`，其他语言走 fallback。
- 已有协议页面不动；唯一例外是 `components/realtime/websocket.vue` 增加文本/二进制开关。
- 所有新增纯逻辑模块用 `.mjs`（Node 可直接测试、Nuxt/webpack 4 可导入）；Agent 用 CommonJS。
- 每个适配器的 `close()` 必须清理资源；每个任务结束前跑对应测试。
- 现有构建链 Node 16–18，禁止升级 Nuxt/Webpack。

## Review Focus

以下是跨阶段的 5 个高风险点；每个阶段计划在自己的 Review Focus 里展开，并在 owning task 中放测试。

1. Agent 安全边界：token、Origin 白名单、只绑回环、LNA 授权（阶段 0 Task 2/13/14）。
2. 会话与资源清理：页面关闭、WS 断开、适配器 close 幂等、无残留 socket/timer（阶段 0 Task 3–5，阶段 2 Task 1）。
3. 浏览器直连失败：CORS/Origin 拦截时给出可操作错误，Agent 回退可用（阶段 1 Task 1/13，阶段 2 Task 1）。
4. 二进制保真：WebSocket/STOMP/HTTP binary 逐字节一致；代理路径不可用时要明确提示（阶段 0 Task 8，阶段 1 Task 3/6，阶段 2 Task 2）。
5. 协议子集与真实对端：DNP3/IEC 104/BACnet/Dubbo/Thrift 等只做表中动作，必须有编解码测试与手工/模拟器验收（阶段 3–5 的验收任务）。

## VCS 说明

当前工作目录不是 git 仓库（没有 `.git`）。计划中的 commit 步骤是给已有仓库的执行者用的。
如果执行前仓库仍无 `.git`，在阶段 0 的 Task 1 先执行 `git init` 并提交基线；若用户不希望引入版本控制，
把每个 commit 步骤替换为同一位置的测试/构建检查点。

## 测试与验收基线

- 纯函数与适配器：`node:test`，测试文件与被测模块同阶段任务一起提交。
- Agent 端到端：在 `node:test` 里启动 `createAgentServer`（端口 0），用 `ws` 客户端走真实握手。
- 需要真实 broker/服务的协议：单元测试 + 可选集成测试，用环境变量启用（如 `RABBITMQ_URL`）。
- 工业协议：mock peer 或 Docker 模拟器；不要求真实硬件。真实设备验证写进 README 的手工清单。
- 浏览器条目：Cypress 覆盖表单、连接状态、错误提示；HLS/WebRTC 媒体面允许人工按清单验证。
- 每阶段结束跑 `npm run test:unit && npm run test:agent && npm run generate && npx cypress run`。
