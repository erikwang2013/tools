# Protocol Lab：多协议调试支持设计

日期：2026-10-24
状态：待评审

## 1. 目标

tools.erik.xyz 是一个纯浏览器端 API 调试工具（Nuxt 2 静态站，nginx 托管）。
现有协议：REST/HTTP、GraphQL、WebSocket（文本）、SSE、Socket.IO、MQTT。

需求：把用户列出的、尚未支持的协议全部加上；已有协议保持不动。

去重后共 **38 个协议/能力**，按实现路径分为六类：HTTP 家族变体、浏览器原生实时协议、
原始传输与流媒体、RPC 与消息队列、IoT/工业协议、Agent 协议。加上 STOMP 的两种传输，
共 **39 个新增条目**。

## 2. 现状与硬约束

- 产物是静态 SPA，没有自己的服务端。Dockerfile 只执行 `nuxt generate`，再由 nginx 托管。
- 浏览器只能直接发 HTTP(S)、WebSocket、SSE、WebRTC；不能开 TCP/UDP/Unix socket，
  也不能说 Kafka、AMQP、gRPC、Dubbo、Modbus、DNP3 等协议帧。
- 构建链只支持 Node 16–18（Nuxt 2.12）。
- nginx CSP 已是 `connect-src *`，页面可以发起 `ws://127.0.0.1:PORT` 连接；但 HTTPS 页面连
  本机回环还需要浏览器的本地网络访问授权（见 4.6），CSP 不是这里的阻塞点。
- 11 个语言包，缺失键回退到 `en-US.json`（`fallbackLocale: "en"`）。
- 现有 HTTP 请求链路支持浏览器直连、浏览器扩展、自建代理三种策略。

## 3. 关键决定

### 3.1 用本地 Agent，不做网站后端，也不做公网中继

静态站的定位不变。新增一个只监听 `127.0.0.1` 的本地伴随进程（下称 Agent），
由用户在自己机器上启动，页面对它说 WebSocket。所有浏览器做不到的协议都由 Agent 代发。

- 不把公共网站变成开放代理：公网后端若能替任何人连任意 TCP/UDP，等于 SSRF/端口扫描服务，
  也与现有静态部署矛盾。
- 不把 Agent 暴露到局域网或公网：只绑 `127.0.0.1`，加 token 与 Origin 白名单。
- Agent 掉线时，浏览器原生协议照常可用；需要 Agent 的条目标记为不可用并给出启动提示。
- 浏览器范围：Chrome/Edge 优先，首次连接会弹一次本地网络访问授权；Firefox 尽力支持；
  Safari 不支持 Agent 协议（混合内容拦截）。

### 3.2 一个协议实验台 + 注册表，而不是 39 个页面

新增 `/protocols` 页面。协议以注册表描述（字段、动作、载荷类型、传输路径），
通用组件按描述渲染表单、连接/发送/关闭按钮和日志。只有流程确实不同的协议写专属面板。

这样 39 个条目共享一套 UI、日志、二进制编辑器与错误处理，新增协议主要是几十行适配器。

### 3.3 已有协议不动

REST/HTTP、GraphQL、WebSocket 文本、SSE、Socket.IO、MQTT 的页面和逻辑不改。
唯一例外是用户明确列出的 **WebSocket Binary Frame**：在现有 WebSocket 组件上增加
一个文本/二进制开关（新增能力，不改变原行为）。

## 4. 总体架构

### 4.1 新增目录

```
agent/                        本地伴随进程，独立 package.json，不参与 nuxt generate
  index.js                    WS/HTTP server、鉴权、Origin 校验、生命周期
  lib/protocol.js             消息信封与编解码
  lib/hooks.js                Webhooks 入站接收
  adapters/                   每个协议一个适配器（多数 20–80 行）
  test/                       node:test 单元测试（编解码、帧解析）
protocols/
  registry.js                 协议描述表（唯一事实来源）
  groups.js                   分组与排序
components/protocols/
  lab.vue                     通用实验台（表单 + 动作 + 日志）
  payload.vue                 统一载荷编辑器（text/json/xml/hex/base64/file）
  log.vue                     文本/十六进制日志、方向、时间戳
  panels/                     流程专属面板：webrtc、hls、stomp、xmpp、sip、mcp、a2a、webhooks
pages/protocols.vue           路由页
functions/agent.js            Agent 客户端单例（连接、重连、sessionStorage token）
functions/httpRequest.js      HTTP 家族共用的规范化发送函数
```

### 4.2 Agent 通信协议

WebSocket，JSON 信封；二进制一律 base64，单条上限 16 MiB。

```
页面 -> Agent: { v:1, id, type:"auth"|"open"|"send"|"close"|"hook:reply",
                 token?, protocol?, config?, payload? }
Agent -> 页面: { v:1, id, type:"ready"|"log"|"data"|"error"|"closed",
                 payload: { ... } }
```

- 连接后第一条消息必须是 `auth`，失败则立即断开。
- `id` 对应页面上的一个会话；关闭页面/WS 时 Agent 关闭该会话的全部 socket、定时器和订阅。
- 建立连接超时 30 秒；已建立的会话**不会因空闲被回收**，只在页面 WS 关闭或页面显式
  `close` 时清理。每页最多 32 个会话，单条消息 16 MiB。
- Agent 每 30 秒发 WebSocket ping，60 秒无 pong 视为页面已消失并回收会话。
- 适配器统一接口：`open(config, emit)`、`send(payload)`、`close()`；`emit` 推送 `log`/`data`。

### 4.3 协议注册表

```js
{
  id: "modbus-tcp",
  label: "Modbus TCP",
  group: "IoT / 工业",
  transport: "agent",        // browser | http | agent
  fields: [
    { key: "host", label: "Host", type: "text", default: "127.0.0.1" },
    { key: "port", label: "Port", type: "number", default: 502 },
    { key: "action", label: "Action", type: "select", options: [...] },
  ],
  payload: "json",           // none | text | json | xml | binary
  actions: ["connect", "send", "close"],
  panel: null                // 需要专属面板时填组件名
}
```

字段类型：`text`、`number`、`password`、`select`、`checkbox`、`textarea`、`file`、
`keyvalue`（headers/metadata）、`timer`。通用实验台负责渲染、校验和把值交给发送层。

### 4.4 统一载荷编辑器

所有二进制/文本载荷共用一个组件，模式：文本、JSON、XML、Hex、Base64、本地文件。
Hex 模式实时校验并显示字节数；文件模式在浏览器内读取，不把路径交给 Agent。
响应侧同样支持文本与 hexdump 切换。

### 4.5 日志

复用现有视觉风格，新写 `components/protocols/log.vue`：方向（发送/接收/信息/错误）、
时间戳、文本或 hex 渲染、自动滚动、最多保留 2000 条。现有 `realtime/log.vue` 不动。

### 4.6 Agent 连接入口

设置页新增「Local Agent」区块：地址（默认 `ws://127.0.0.1:3567`）、token、连接/断开、
状态指示。token 由 Agent 每次启动随机生成并打印在终端；页面用 `sessionStorage` 记住，
不用 `localStorage`，也不进 Vuex 持久化。Agent 地址可作为普通设置项持久化。

`/protocols` 页顶部常驻 Agent 状态条；需要 Agent 的协议在离线时禁用并提示启动命令。

Chrome/Edge 首次连接回环地址时由浏览器弹出「本地网络访问」授权；被拒绝或被企业策略禁止时，
状态条给出可操作的说明。Safari 下 Agent 条目显示不支持；Firefox 作为 best-effort，不列入验收。

### 4.7 浏览器直连失败时的 Agent 回退

浏览器原生条目优先直连；遇到 CORS、Origin 被拒或网络不可达时，日志里给出明确原因，
并提供「经 Agent 重试」按钮（Agent 未连接时禁用）。

Agent 为此提供两个通用适配器，不按协议重复实现：

- **HTTP 代理**：接收 method/url/headers/body，返回 status/headers/body；仅对白名单 Origin
  返回 CORS 头。SOAP、JSON-RPC、XML-RPC、OData、A2A、远程 MCP 可用它重试。
- **WS 桥接**：页面先通过 Agent 会话登记目标 URL 与 headers，拿一次性本地路径，
  浏览器端库（STOMP/XMPP/SIP）再连这条本地桥；Agent 双向转发帧并记录日志。

HLS 在阶段 1 只支持浏览器直连；分片代理留到后续（见非目标）。MCP stdio 仍只走 Agent 预配置。

## 5. 协议清单

「路径」：浏览器 = 页面直接实现；HTTP = 走现有 HTTP 请求链路；Agent = 本地进程代发。

| # | 协议 | 路径 | 实现要点 | 阶段 |
|---|------|------|----------|------|
| 1 | HTTP/2 | Agent | Node 内置 `http2`，h2/h2c，显示实际协商结果 | 1 |
| 2 | HTTP/3 | Agent | 候选 `@currentspace/http3`；运行时不支持则明确报错，并提示浏览器自动协商可用 | 1 |
| 3 | SOAP | HTTP | endpoint + SOAPAction + XML body，响应 XML 格式化 | 1 |
| 4 | JSON-RPC | HTTP | method / params / id，JSON 请求与错误对象展示 | 1 |
| 5 | XML-RPC | HTTP | 由 method + 参数生成 methodCall，响应解析 | 1 |
| 6 | OData | HTTP | `$filter/$select/$expand/$orderby/$top/$skip` 查询构建 + `$metadata` | 1 |
| 7 | HTTP/HTTPS Binary Body | HTTP | `responseType: arraybuffer`，发送文件/hex/base64，接收 hexdump | 1 |
| 8 | WebSocket Binary Frame | 浏览器 | 现有 WS 组件加文本/二进制开关，二进制按 hex 展示 | 1 |
| 9 | HLS | 浏览器 | `hls.js`：加载播放列表、清晰度/分片日志、可选视频预览 | 1 |
| 10 | WebRTC DataChannel | 浏览器 | 本页 loopback 或手动 SDP 交换；ICE 日志；文本/二进制 | 1 |
| 11 | Webhooks | Agent | 127.0.0.1 入站 HTTP receiver（带随机路径），记录请求并可配置响应 | 1 |
| 12 | A2A | 浏览器 | Agent Card 发现、JSON-RPC、SSE 任务事件 | 1 |
| 13 | MCP | 浏览器 + Agent | 远程 Streamable HTTP/SSE；stdio 仅限 Agent 预配置命令 | 1 |
| 14 | STOMP (WebSocket) | 浏览器 | `@stomp/stompjs`：CONNECT/SUBSCRIBE/SEND，文本/二进制 | 2 |
| 15 | XMPP (WebSocket) | 浏览器 | `@xmpp/client`：JID/密码/message，XML stanza 日志 | 2 |
| 16 | SIP (WebSocket) | 浏览器 | `sip.js`：REGISTER + MESSAGE，信令日志 | 2 |
| 17 | TCP | Agent | `net`：文本/hex 收发，可选行分帧，双向流日志 | 0 |
| 18 | UDP | Agent | `dgram`：收发数据报，显示来源地址 | 0 |
| 19 | Raw Socket | Agent | TCP/UDP 预设，默认 hex、无分帧、无协议解析 | 3 |
| 20 | Unix Domain Socket | Agent | `net.connect({ path })`，文本/hex | 3 |
| 21 | RTSP | Agent | 原始 TCP：OPTIONS/DESCRIBE/SETUP/PLAY/PAUSE/TEARDOWN，Basic/Digest | 3 |
| 22 | RTMP | Agent | 握手 + connect/createStream/play，chunk 日志（子集） | 3 |
| 23 | RTP | Agent | UDP 收发，RTP 头解析（PT/SSRC/seq/timestamp） | 3 |
| 24 | RTCP | Agent | 发送 RR/SDES，解析 SR/RR 报告 | 3 |
| 25 | ISO 8583 | Agent | MTI + bitmap + 字段 JSON，长度头可配（无/2/4 字节，ASCII/二进制） | 3 |
| 26 | gRPC | Agent | `@grpc/grpc-js` + `@grpc/proto-loader`：unary + server streaming，TLS/metadata | 4 |
| 27 | Dubbo | Agent | Dubbo 协议头 + Hessian2（`hessian.js`），unary | 4 |
| 28 | Thrift | Agent | `.thrift` IDL 解析，TBinaryProtocol，unary | 4 |
| 29 | Hessian | Agent | `hessian.js`，HTTP POST，方法 + 参数 | 4 |
| 30 | AMQP | Agent | `amqplib`：declare / publish / consume / ack | 4 |
| 31 | Kafka | Agent | `kafkajs`：produce / consume，key/value/headers | 4 |
| 32 | STOMP (TCP) | Agent | `stompit` 或最小 STOMP 帧实现 | 4 |
| 33 | CoAP | Agent | `coap`：GET/POST/PUT/DELETE，Observe | 5 |
| 34 | LwM2M | Agent | CoAP + TLV/text 编解码，register/read/write/observe 子集 | 5 |
| 35 | OPC UA Binary | Agent | `node-opcua`：browse / read / write | 5 |
| 36 | Modbus TCP | Agent | `modbus-serial`：读写线圈/寄存器，可选轮询 | 5 |
| 37 | DNP3 | Agent | `dnp3` 包：完整性轮询、class 扫描、遥控 | 5 |
| 38 | IEC 60870-5-104 | Agent | STARTDT / 总召唤 / 读，ASDU 子集 | 5 |
| 39 | BACnet/IP | Agent | `bacstack` 或 `@bacnet-js/client`：who-is / readProperty / writeProperty | 5 |

候选库在实现阶段逐一验证；表中标「或」的允许换成更可靠的最小自实现。

已存在、不新增：REST/HTTP、GraphQL、WebSocket 文本、SSE、Socket.IO、MQTT。
MQTT 保持现有 WebSocket 传输，不新增 TCP 传输（用户要求已有协议不动）。

## 6. 分组实现说明

### 6.1 HTTP 家族

SOAP、JSON-RPC、XML-RPC、OData、HTTP Binary Body 都只是 HTTP 的请求构造与展示差异。
它们复用 `sendNetworkRequest`，因此仍然尊重用户在设置里选择的代理/扩展策略：
`functions/httpRequest.js` 调它并归一化为 `{ status, headers, data }`（约 10 行）。

- 响应格式化：SOAP/XML-RPC 用浏览器 `DOMParser` 缩进；JSON-RPC 展示 `result` 或 `error`。
- 二进制响应走浏览器直连时最可靠；经扩展/自建代理时若拿不到 arraybuffer，明确提示原因。
- HTTP/2、HTTP/3 必须由 Agent 强制指定版本；浏览器只能自动协商，无法强制，也不能在页面上
  可靠读取每请求的协商版本，所以这两个是 Agent 条目。表单只含 URL、方法、headers、body。

### 6.2 浏览器原生实时协议

- **WebRTC DataChannel**：默认在同一页面内建立两个 PeerConnection 做 loopback 测试；
  也支持粘贴远端 SDP 做手工信令。显示 ICE 状态、候选、通道开关；可选 STUN URL，TURN 不做。
- **HLS**：用 `hls.js` 加载 master playlist，展示变体、分辨率、码率、分片序列；
  不处理 DRM；Safari 原生 HLS 作为回退。
- **STOMP / XMPP / SIP**：各自专属面板；底层客户端库用动态 `import()`，只在打开对应协议时加载，
  不增加首屏体积。STOMP 的 WebSocket 与 TCP 两个条目共用同一套 UI，只是传输不同。
- **MCP**：远程传输（Streamable HTTP / SSE）在浏览器完成，展示 initialize、tools/resources/prompts、
  tool call 与 JSON-RPC 日志；stdio 传输由 Agent 执行，页面上只能从 Agent 启动时配置的
  server 列表中选择，不能临时提交任意命令。
- **A2A**：拉取 Agent Card，构造 `message/send`，SSE 事件流式展示；不做 push notification。

### 6.3 原始传输与流媒体

- TCP/UDP/Unix socket 是最薄的一层：Node 内置模块，无第三方依赖。TCP 默认按字节流展示，
  可选换行分帧；UDP 按数据报展示来源。
- Raw Socket 是 TCP/UDP 的预设条目，复用同一适配器，默认 hex、关闭分帧。
- RTSP/RTMP 用原始 TCP 实现协议子集：只做调试所需方法，不实现媒体编解码与播放。
- RTP/RTCP 用 UDP；RTP 解析固定头，RTCP 只解析 SR/RR/SDES。
- ISO 8583 附带一份 ISO 8583:1987 默认域定义，并允许编辑域表；长度头可配。

### 6.4 RPC 与消息队列

- gRPC：用户粘贴或上传 `.proto`，列出 service/method，请求体按 JSON 编辑；
  不支持 server reflection。
- Thrift：粘贴或上传 `.thrift`，解析 service/method；只支持 TBinaryProtocol。
- Dubbo：接口名、方法名、参数类型、JSON 参数；Dubbo 头 + Hessian2 编解码，unary。
- Hessian：HTTP POST，方法名 + JSON 参数，hessian.js 编解码。
- AMQP/Kafka/STOMP-TCP：连接、声明/发布/订阅/消费、ack；消息体支持文本/hex。
- 所有 Agent 适配器默认校验证书；每个连接提供「允许自签名」开关，默认关闭。

### 6.5 IoT / 工业协议

Modbus TCP、DNP3、IEC 104、BACnet/IP 都是「连接参数 + 动作 + 点表/参数 + 轮询」形态，
共用通用实验台。CoAP/LwM2M 共用 `coap` 传输。OPC UA 使用 `node-opcua`。
每个协议的可用动作在注册表里显式列出，不做完整协议栈；例如 DNP3 不做文件传输，
BACnet 不做 COV 订阅，LwM2M 不做 Bootstrap。

### 6.6 Agent 协议（Webhooks / MCP stdio）

Agent 在同一个端口上同时提供 WebSocket 与一个仅本机可达的 HTTP 入站路径：

- `/hook/<随机路径>`：接收任意方法、headers、body，实时推给页面；页面可预设响应码/响应体。
- 随机路径由 Agent 启动时生成，随 token 一起显示；不写日志到磁盘。
- MCP stdio 的 server 命令只能来自 Agent 的启动配置（CLI 参数或 `agent/config.json`），
  页面不能提交命令、路径或环境变量。

## 7. 对现有代码的改动

新增：上述 `agent/`、`protocols/`、`components/protocols/`、`pages/protocols.vue`、
`functions/agent.js`、`functions/httpRequest.js`、设计/使用文档、测试。

修改：

| 文件 | 改动 |
|------|------|
| `components/layout/sidenav.vue` | 新增 `/protocols` 入口与页面内锚点 |
| `pages/settings.vue` | 新增 Local Agent 区块（地址、token、连接状态） |
| `lang/en-US.json` | 新增约 15 个通用 UI 文案键；协议名保持英文专有名词 |
| `nuxt.config.js` | sitemap 增加 `/protocols` |
| `components/realtime/websocket.vue` | 仅加文本/二进制开关与二进制 hex 展示 |
| `package.json` | 新增 `agent` 脚本；新增浏览器端依赖（全部动态 import） |
| `README.md` | 新增 Agent 启动与协议使用说明 |

不动：`pages/index.vue`、`pages/graphql.vue`、`pages/realtime.vue`、现有 realtime 组件、
Vuex store 结构、构建链、Dockerfile、nginx.conf。

## 8. 安全边界

- Agent 只绑 `127.0.0.1`；每次启动生成随机 token；页面首条消息必须携带 token。
- WebSocket 升级时校验 `Origin`：只允许 `https://tools.erik.xyz` 与本地开发地址。
  这阻止任意网页驱动用户本机的 Agent。
- 页面永远不向 Agent 传文件路径；文件由浏览器读取后按字节发送。
- MCP stdio 命令来自 Agent 配置，页面只能选择，不能新增。
- 单条消息 16 MiB、最多 32 个会话；建立连接超时 30 秒；已建立的会话不因空闲被回收，
  WS 断开即回收全部资源。
- TLS 默认校验证书；「允许自签名」是显式、逐连接的调试开关。
- token 存 `sessionStorage`，不进 Vuex 持久化；不写磁盘。
- Agent 是用户主动安装和启动的本地工具，不随网站部署，不监听外部网卡。

## 9. 非目标

- 不为新协议做集合/历史持久化；刷新页面后配置不保留（会话内有效）。
- 不做流量录制、代码生成、导入导出、自动化测试脚本。
- 不提供公网托管的 Agent 或中继服务。
- HLS 阶段 1 不做 Agent 分片代理；Safari 不支持 Agent 协议。
- 不做完整协议栈：只覆盖调试所需动作（见各分组）。
- 不新增 MQTT TCP 传输（现有 MQTT 保持不动）。
- 不本地化协议名与技术标签；通用 UI 文案只写英文，其他语言走 fallback。
- 不做桌面打包、安装器、自动更新。
- 不修改现有 HTTP 请求页来加协议选择器；新协议走 `/protocols`。

## 10. 交付阶段

每一阶段独立可用、可验收。

**阶段 0 — 框架与证明**
Agent 骨架、WS 信封、鉴权/Origin、注册表、`/protocols` 页、通用实验台、载荷编辑器、
日志、Agent 状态条、设置页入口；用 TCP 与 UDP 端到端证明。
验收：Chrome/Edge 下完成一次本地网络访问授权后，TCP/UDP echo 收发正常；错误 token 与
非白名单 Origin 被拒；`npm run generate` 仍通过。

**阶段 1 — HTTP 家族与浏览器基础能力**
SOAP、JSON-RPC、XML-RPC、OData、HTTP Binary Body、HTTP/2、HTTP/3、HLS、
WebRTC DataChannel、Webhooks、A2A、MCP、WebSocket Binary Frame。

**阶段 2 — 浏览器实时协议**
STOMP (WebSocket)、XMPP (WebSocket)、SIP (WebSocket)。

**阶段 3 — 原始传输与流媒体**
Raw Socket、Unix Domain Socket、RTSP、RTMP、RTP、RTCP、ISO 8583。

**阶段 4 — RPC 与消息队列**
gRPC、Dubbo、Thrift、Hessian、AMQP、Kafka、STOMP (TCP)。

**阶段 5 — IoT / 工业**
CoAP、LwM2M、OPC UA Binary、Modbus TCP、DNP3、IEC 60870-5-104、BACnet/IP。

阶段顺序理由：先建立通用框架与最薄的 raw socket，证明 Agent 链路；再做低成本、
高确定性的 HTTP 与浏览器能力；然后按「协议复杂度 + 库可靠性」从低到高推进。
阶段 4、5 的条目互不依赖，可在阶段 3 后并行。

**验收基线（每个阶段）**

- Agent 适配器的帧/编解码有 `node:test` 单元测试。
- 能起参考对端的协议，用 Docker 或模拟器做一次真实往返；不可轻松容器化的
  （Dubbo、Thrift 测试服务、ISO 8583 对端）做编解码往返 + 手工验证步骤。
- 不要求真实硬件；工业协议用模拟器验证，真实设备验证由用户自行完成并记录在 README。
- 浏览器条目用 Cypress 覆盖表单、连接状态、错误提示；HLS/WebRTC 的媒体面由人工按清单验证。
- 每阶段结束跑一次 `npm run generate` 与现有 e2e，确认不回归。

参考对端优先用 Docker：Redpanda（Kafka）、RabbitMQ（AMQP）、gRPC echo、CoAP 服务、
Prosody（XMPP）、Asterisk/Kamailio（SIP）、mediamtx（RTSP/RTMP/HLS）、
Modbus/DNP3/IEC 104/BACnet/OPC UA 模拟器。

## 11. 风险与实现时需要验证的点

1. **本地网络访问授权**：Chrome/Edge 的 LNA 授权可能被拒绝或被企业策略禁用，这是所有
   Agent 协议的前置条件。阶段 0 必须在目标 Chrome/Edge 版本上实测，并把失败提示做成
   可操作的引导。Safari 明确不支持；Firefox 不列入验收。
2. **CORS/Origin 目标**：A2A、远程 MCP、STOMP/XMPP/SIP 的目标服务器可能不允许本页 Origin；
   已有 Agent 回退兜底，但回退路径要单独测试，并在 UI 上说明当前是直连还是经 Agent。
3. **HTTP/3**：Node 18 无内置 QUIC。`@currentspace/http3` 的 Node 18 兼容性需先验证；
   若不可用，保留条目但明确报「当前运行时不可用」，并说明浏览器 HTTPS 会自动协商。
4. **库可靠性**：DNP3、IEC 104、BACnet、Thrift IDL 解析等库维护状态不一。
   先做 spike 验证；不可用的按表中「或最小自实现」处理，自实现只覆盖表中动作。
5. **二进制与代理**：现有扩展/代理策略对 arraybuffer 响应支持不一致；HTTP Binary Body
   在代理路径下可能只能显示文本。实现时给出明确提示，不静默失败。
6. **Nuxt 2 构建**：新增浏览器依赖必须能在 Node 18 + Nuxt 2.12 下构建；一律动态 import
   并做构建验证。sip.js、@xmpp/client、hls.js 的体积只在打开协议时加载。
7. **RTMP/Dubbo/LwM2M/ISO 8583** 只做子集，文档与界面必须写清支持范围，避免让人误以为
   是完整实现。
8. **本地 Agent 的使用门槛**：用户需要自己启动进程。README 与页面提示必须一步到位；
   Agent 不随静态站分发，安装体验不在本设计范围内。
9. **协议配置不持久化**：刷新即丢失。这是本期的有意取舍；若实际使用中成为痛点，再单独立项。

## 12. 已做的决定（可推翻）

- Agent 运行时用 Node 18（与仓库一致），独立 `agent/package.json`，`node:test` 做单元测试。
- 新页面路由为 `/protocols`，导航名「Protocols」。
- 通用 UI 文案只加到 `en-US.json`，协议标签保持英文。
- 专属面板仅限 WebRTC、HLS、STOMP、XMPP、SIP、MCP、A2A、Webhooks；其余用通用实验台。
- HTTP 家族复用现有请求链路，因此继承用户的代理/扩展设置。
- Agent token 存 `sessionStorage`，Agent 地址作为普通设置持久化。
- 新协议不接入集合、历史、环境变量、前置脚本。
- 阶段 4、5 可在阶段 3 后并行，不要求严格串行。
- 浏览器范围：Chrome/Edge 优先（LNA 授权），Firefox best-effort，Safari 不支持 Agent 协议。
- 验收：编解码单测 + 本地参考对端冒烟；不依赖真实硬件；不要求所有协议都有容器化对端。
- 浏览器直连被 CORS/Origin 拦截时提供「经 Agent 重试」；HLS 阶段 1 不做代理。
- 已建立的 Agent 会话不因空闲被回收；只在页面 WS 关闭或显式 `close` 时清理。
