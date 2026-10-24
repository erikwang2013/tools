# Protocol Lab 阶段 3：原始传输与流媒体实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 Raw Socket、Unix Domain Socket、RTSP、RTMP、RTP、RTCP、ISO 8583 七个条目。

**Architecture:** 全部由 Agent 适配器实现。Raw Socket 复用 TCP/UDP；UDS 用 `net.connect({path})`；RTSP/RTMP/ISO 8583 是原始 TCP 协议；RTP/RTCP 是原始 UDP。

**Tech Stack:** Node 18 `net`、`dgram`、`crypto`；`node:test`；Cypress 只测 UI 壳。

**Spec:** `docs/superpowers/specs/2026-10-24-protocol-lab-design.md`
**共享契约:** `docs/superpowers/plans/2026-10-24-protocol-lab-index.md`
**前置:** 阶段 0–2 全部任务通过

## Global Constraints

- 沿用阶段 0–2 的全部约束。
- 每个适配器的 `close()` 必须幂等，并清理 socket、定时器、解析缓冲。
- 不实现媒体编解码；RTSP/RTMP 只做协议交换与日志。
- ISO 8583 默认使用 1987 域定义的常用子集，界面与文档写明支持范围。
- Unix Domain Socket 只支持路径型 socket（Linux/macOS）；Windows 命名管道不在范围。
- 所有协议仍受 16 MiB / 32 会话 / 30 秒建立超时约束。

## Review Focus

1. TCP 半关闭：页面只收到一次 `closed`，不重复关闭、不悬挂（Task 1）。
2. RTSP Digest 挑战：必须用同一 nonce 重试一次并带 Authorization；失败不再循环（Task 2）。
3. RTMP 握手版本/长度不匹配：明确报错，不进入无限等待（Task 3）。
4. ISO 8583 未知域或位图不一致：解码错误必须指出域号，不得静默截断（Task 5）。
5. RTP 畸形包（长度 < 12）：按 hex 记录，不崩溃（Task 4）。

---

### Task 1: Raw Socket 与 Unix Domain Socket

**Files:**
- Create: `agent/adapters/raw-socket.js`
- Create: `agent/adapters/unix-socket.js`
- Create: `agent/test/raw-socket.test.js`
- Create: `agent/test/unix-socket.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `protocols/registry.mjs`（`raw-socket`, `unix-socket`）

**Interfaces:**
- Consumes: `tcp`、`udp` 适配器、`fromBuffer`/`toBuffer`
- Produces:
  - `raw-socket`：config `{ kind:"tcp"|"udp", host, port, bindPort?, encoding }`，代理到对应适配器
  - `unix-socket`：config `{ path, encoding }`

- [ ] **Step 1: 写 Raw Socket 失败测试**

`agent/test/raw-socket.test.js`：分别用 TCP echo 与 UDP echo，断言 `raw-socket` 转发收发、`close()` 后无残留。

- [ ] **Step 2: 写 UDS 失败测试**

`agent/test/unix-socket.test.js`：在 `os.tmpdir()` 建 socket 路径，起 `net.createServer(s => s.pipe(s))`，适配器 `create({path, encoding:"utf8"})`，发送 `hello`，断言回显；删除临时文件。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，找不到适配器

- [ ] **Step 4: 实现**

`raw-socket.js`：

```js
const tcp = require("./tcp")
const udp = require("./udp")
module.exports = {
  id: "raw-socket",
  create(config, emit) {
    const base = config.kind === "udp" ? udp : tcp
    return base.create({ ...config }, emit)
  },
}
```

`unix-socket.js`：与 `tcp.js` 相同，但 `net.connect({ path: config.path })`；`error` 时 emit `error` 并 `closed`。

- [ ] **Step 5: 注册表条目**

- `raw-socket`：fields `kind`(select tcp/udp)、`host`、`port`、`bindPort`、`encoding`(select base64/utf8)；payload `binary`；默认 hex 展示。
- `unix-socket`：fields `path`(text, required)、`encoding`；payload `binary`。

- [ ] **Step 6: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add agent/adapters/raw-socket.js agent/adapters/unix-socket.js agent/test/raw-socket.test.js agent/test/unix-socket.test.js agent/adapters/index.js protocols/registry.mjs
git commit -m "feat(agent): add raw socket and unix domain socket"
```

---

### Task 2: RTSP 适配器

**Files:**
- Create: `agent/adapters/rtsp.js`
- Create: `agent/lib/rtsp.js`（请求构造、响应解析、Digest）
- Create: `agent/test/rtsp.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `protocols/registry.mjs`（`rtsp`）

**Interfaces:**
- Consumes: `net`、`crypto`
- Produces:
  - `buildRtspRequest({ method, uri, cseq, headers }) -> string`
  - `parseRtspResponse(buffer) -> { status, headers, body, consumed, interleaved? }`
  - `digestAuthorization({ username, password, realm, nonce, method, uri, qop? }) -> string`
  - 适配器 `rtsp`：config `{ url, method, username, password, allowSelfSigned? }`；`send` 发送当前 method 请求

- [ ] **Step 1: 写解析与 Digest 失败测试**

`agent/test/rtsp.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const { buildRtspRequest, parseRtspResponse, digestAuthorization } = require("../lib/rtsp")

test("builds a request with CSeq and parses a response", () => {
  const req = buildRtspRequest({ method: "DESCRIBE", uri: "rtsp://x/a", cseq: 1, headers: { Accept: "application/sdp" } })
  assert.match(req, /^DESCRIBE rtsp:\/\/x\/a RTSP\/1.0\r\n/)
  const res = parseRtspResponse(Buffer.from("RTSP/1.0 200 OK\r\nCSeq: 1\r\nContent-Length: 2\r\n\r\nhi"))
  assert.equal(res.status, 200)
  assert.equal(res.headers.CSeq, "1")
  assert.equal(res.body, "hi")
})

test("computes RFC 2617 digest", () => {
  const auth = digestAuthorization({ username: "u", password: "p", realm: "r", nonce: "n", method: "DESCRIBE", uri: "rtsp://x/a" })
  assert.match(auth, /^Digest username="u", realm="r", nonce="n", uri="rtsp:\/\/x\/a", response="[0-9a-f]{32}"$/)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 3: 实现 `agent/lib/rtsp.js`**

- 请求行 + `CSeq` + `User-Agent: Postwoman-Agent` + 额外 headers + `\r\n`。
- 响应解析：按 `\r\n\r\n` 分头体；`Content-Length` 决定 body 长度；支持 `$` 开头的 interleaved 帧（返回 `interleaved: { channel, data }`）。
- Digest：RFC 2617 MD5，`qop` 存在时支持 `auth`，`nc=00000001`、`cnonce` 随机。

- [ ] **Step 4: 实现适配器**

- `create`：解析 URL，`net.connect(host, port)`，`ready: { protocol: "rtsp" }`。
- 首次连接后发 `OPTIONS`。
- `send`：发送 `config.method` 请求（默认 DESCRIBE），带 `CSeq` 自增。
- 收到 `401` 且 `WWW-Authenticate: Digest` 时，用同一 URI/method 重试一次并带 `Authorization`；只重试一次。
- 响应 body 文本进日志；interleaved 帧按 hex 进日志。
- `close()` 销毁 socket；`error`/`close` emit 一次 `closed`。
- 30 秒连接超时。

- [ ] **Step 5: 写 mock 服务器测试**

`agent/test/rtsp.test.js` 增加：起 `net.createServer`，第一次返回 401 + Digest 挑战，第二次校验 `Authorization` 后返回 200 + SDP；断言适配器收到 200 且只发两次请求。

- [ ] **Step 6: 注册表条目**

`rtsp`：fields `url`、`method`(select OPTIONS/DESCRIBE/SETUP/PLAY/PAUSE/TEARDOWN)、`username`、`password`；payload `none`；actions `["connect","send","close"]`。

- [ ] **Step 7: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add agent/adapters/rtsp.js agent/lib/rtsp.js agent/test/rtsp.test.js agent/adapters/index.js protocols/registry.mjs
git commit -m "feat(agent): add rtsp adapter"
```

---

### Task 3: RTMP AMF0、握手与 chunk 编解码

**Files:**
- Create: `agent/lib/amf0.js`
- Create: `agent/lib/rtmp-chunk.js`
- Create: `agent/test/amf0.test.js`
- Create: `agent/test/rtmp-chunk.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `encodeAmf0(value) -> Buffer`
  - `decodeAmf0(buffer) -> { value, consumed }`
  - `rtmpHandshake(socket) -> Promise<void>`（C0/C1/S0/S1/S2 校验）
  - `encodeChunk({ csid, typeId, streamId, timestamp, payload, chunkSize }) -> Buffer`
  - `RtmpChunkDecoder`（`push(buffer) -> messages[]`）

- [ ] **Step 1: 写 AMF0 失败测试**

覆盖 `number`、`boolean`、`string`、`object`、`null`、`array` 的 encode/decode 往返；未支持类型抛错。

- [ ] **Step 2: 写 chunk 失败测试**

- 小消息（< chunkSize）单 chunk 往返。
- 大消息（> chunkSize）分片后 decoder 重组一致。
- type 0/1/2/3 的 header 长度正确。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 4: 实现**

- AMF0：只支持 RTMP 命令所需类型；`decodeAmf0` 返回 consumed 便于连续解码。
- 握手：写 C0+C1（C0 version 3，C1 随机 1536 字节，时间戳 0）；读 S0 校验 version 3，读 S1/S2；校验 S2 前 4 字节等于 C1 时间戳（可为 0）；写 C2（S1 回显）。任何长度/版本不符抛 `RTMP handshake failed: ...`。
- Chunk：默认 chunkSize 128；支持 basic header 1 字节（csid 2–63）；type 0/1/2/3；只支持单一 chunk stream 的顺序解码，足够命令与基础媒体。
- 解码缓冲上限 16 MiB；超限抛错。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent/lib/amf0.js agent/lib/rtmp-chunk.js agent/test/amf0.test.js agent/test/rtmp-chunk.test.js
git commit -m "feat(agent): add amf0 and rtmp chunk codecs"
```

---

### Task 4: RTMP 适配器（connect/createStream/play/publish）

**Files:**
- Create: `agent/adapters/rtmp.js`
- Create: `agent/test/rtmp.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `protocols/registry.mjs`（`rtmp`）
- Modify: `agent/lib/rtmp-chunk.js`（按需补命令编码辅助）
- Create: `agent/test/fixtures/rtmp-server.js`

**Interfaces:**
- Consumes: Task 3 的 AMF0/chunk/handshake
- Produces: 适配器 `rtmp`；config `{ url, action:"play"|"publish" }`；`ready: { app, streamName }`

- [ ] **Step 1: 写 fixture RTMP 服务器**

`agent/test/fixtures/rtmp-server.js`：完成握手；解析 chunk；对 `connect` 返回 `_result`（含 `fmsVer`）；对 `createStream` 返回 `_result`（stream id 1）；记录 `play`/`publish` 命令；可选发送一条 `onStatus`。用 Task 3 的 codec 构造响应。

- [ ] **Step 2: 写适配器失败测试**

起 fixture 服务器；适配器 `create({ url: "rtmp://127.0.0.1:<port>/app/stream", action:"play" })`；断言：
- 收到 `ready.app === "app"`、`ready.streamName === "stream"`；
- fixture 收到 `connect`/`createStream`/`play`；
- `close()` 后 socket 关闭。

再测 `publish` 路径与握手版本错误（fixture 返回 S0 version 2）→ 错误信息含 `handshake`。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，未知协议

- [ ] **Step 4: 实现适配器**

- 解析 `rtmp://host:port/app/stream`（默认端口 1935）。
- 连接 → 握手 → `connect`（AMF0 object：app、type、flashVer、tcUrl）→ 等 `_result` → `createStream` → 等 `_result` 拿 stream id → `play` 或 `publish`。
- `send(payload)`：`publish` 模式下把 payload 作为 type 8/9 媒体消息写入（type 由 config `mediaType: "audio"|"video"` 选择，默认 video）；`play` 模式下忽略并记日志。
- 收到的媒体/命令消息：命令按 AMF0 解码为日志；媒体按 hex 日志（截断到前 4 KiB，注明总长度）。
- `close()` 发送 `deleteStream`（尽力而为）并销毁 socket。
- 超时 30 秒；握手错误信息以 `RTMP handshake failed` 开头。

- [ ] **Step 5: 注册表条目**

`rtmp`：fields `url`、`action`(select play/publish)、`mediaType`(select audio/video，仅 publish 用)；payload `binary`。

- [ ] **Step 6: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add agent/adapters/rtmp.js agent/test/rtmp.test.js agent/test/fixtures/rtmp-server.js agent/adapters/index.js protocols/registry.mjs agent/lib/rtmp-chunk.js
git commit -m "feat(agent): add rtmp adapter"
```

---

### Task 5: RTP 与 RTCP 适配器

**Files:**
- Create: `agent/lib/rtp.js`
- Create: `agent/adapters/rtp.js`
- Create: `agent/adapters/rtcp.js`
- Create: `agent/test/rtp.test.js`
- Create: `agent/test/rtcp.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `protocols/registry.mjs`（`rtp`, `rtcp`）

**Interfaces:**
- Consumes: `dgram`、`fromBuffer`/`toBuffer`
- Produces:
  - `buildRtpPacket({ payloadType, sequence, timestamp, ssrc, marker }, payload) -> Buffer`
  - `parseRtpPacket(buf) -> { version, payloadType, sequence, timestamp, ssrc, marker, payload }`
  - `parseRtcpPackets(buf) -> [{ type, length, ... }]`
  - 适配器 `rtp` / `rtcp`

- [ ] **Step 1: 写 RTP 失败测试**

- 构造包再解析，字段一致。
- 11 字节的畸形包解析抛错但适配器把它作为 hex 日志，不崩溃。
- 适配器经 UDP 发送到本地接收端，断言头部字段与 payload。

- [ ] **Step 2: 写 RTCP 失败测试**

- 构造一个 RR 包，`parseRtcpPackets` 返回 `type: 201`。
- 适配器发送 RR，接收端拿到 8 字节以上；收到 SR 时打印 NTP/包数/字节数。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 4: 实现**

RTP 头：V=2、P=0、X=0、CC=0、M、PT、sequence (16)、timestamp (32)、SSRC (32)，big-endian。适配器 config：`host`、`port`、`bindPort`、`payloadType`(default 96)、`ssrc`(default 随机)、`sequence`(default 1)、`timestamp`(default 0)、`clockRate`。发送时每包 sequence+1、timestamp+clockRate/50（20ms）；接收解析后 emit 文本摘要 + hex payload。
RTCP：发送 RR（type 201）与 SDES（type 202，CNAME）；解析 SR (200)/RR (201)/SDES (202)/BYE (203)，日志摘要。payload `none` 或用于 CNAME 的 text。

- [ ] **Step 5: 注册表条目**

- `rtp`：fields host、port、bindPort、payloadType、ssrc、timestamp；payload `binary`。
- `rtcp`：fields host、port、bindPort、cname；payload `none`。

- [ ] **Step 6: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add agent/lib/rtp.js agent/adapters/rtp.js agent/adapters/rtcp.js agent/test/rtp.test.js agent/test/rtcp.test.js agent/adapters/index.js protocols/registry.mjs
git commit -m "feat(agent): add rtp and rtcp adapters"
```

---

### Task 6: ISO 8583 适配器

**Files:**
- Create: `agent/lib/iso8583.js`
- Create: `agent/adapters/iso8583.js`
- Create: `agent/test/iso8583.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `protocols/registry.mjs`（`iso8583`）

**Interfaces:**
- Consumes: `net`
- Produces:
  - `encodeIso8583({ mti, fields }, { lengthHeader, lengthEncoding }) -> Buffer`
  - `decodeIso8583(buffer, { lengthHeader, lengthEncoding }) -> { mti, fields }`
  - `FIELD_SPECS`（1987 常用域：2,3,4,7,11,12,13,32,37,39,41,42,49,55）
  - 适配器 `iso8583`：config `{ host, port, lengthHeader:"none"|"2"|"4", lengthEncoding:"ascii"|"binary", timeoutMs }`

- [ ] **Step 1: 写编解码失败测试**

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const { encodeIso8583, decodeIso8583 } = require("../lib/iso8583")

test("round-trips a 0200 message with fixed and llvar fields", () => {
  const msg = { mti: "0200", fields: { 2: "4111111111111111", 3: "000000", 4: "000000010000", 7: "1024150000", 11: "123456", 41: "TERM0001", 42: "MERCHANT0000001" } }
  const buf = encodeIso8583(msg, { lengthHeader: "2", lengthEncoding: "ascii" })
  assert.equal(buf.subarray(0, 4).toString(), "0200")
  assert.deepEqual(decodeIso8583(buf, { lengthHeader: "2", lengthEncoding: "ascii" }), msg)
})

test("rejects an unknown field and a bitmap without its field", () => {
  assert.throws(() => encodeIso8583({ mti: "0200", fields: { 999: "x" } }, {}), /field 999/i)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 3: 实现编解码**

- MTI：4 位 ASCII 数字。
- Bitmap：主位图 8 字节 + 需要时次位图 8 字节；bit 1 表示有次位图。
- 域定义：`{ lenType:"fixed"|"llvar"|"lllvar", length: number, encoding:"ascii"|"bcd", max?: number }`。
- 默认域表覆盖常用域；未知域抛 `Unknown ISO 8583 field <n>`；位图有但域表缺失同样抛错并指出域号。
- 长度头：ASCII 右补空格 2/4 位，或二进制 1/2 字节；`none` 直接发 MTI。
- 解码时按长度头切包；不足抛 `Incomplete ISO 8583 message`。

- [ ] **Step 4: 实现适配器**

- `create`：`net.connect`；`ready: { lengthHeader, lengthEncoding }`。
- `send(payload)`：解析 JSON `{mti, fields}`，编码、加长度头、写入。
- 接收：按长度头拆包、解码，emit 文本 JSON 摘要；无法解码时 emit hex + error。
- 30 秒响应超时；`close()` 销毁 socket。
- 支持一个连接上多次请求（按 CSeq/STAN 由用户填）。

- [ ] **Step 5: 写 TCP 往返测试**

mock 服务器接收请求，用同一编码函数生成 `0210` 响应并回写；断言适配器收到 `mti:"0210"` 与域 39=`"00"`。

- [ ] **Step 6: 注册表条目**

`iso8583`：fields host、port、lengthHeader(select none/2/4)、lengthEncoding(select ascii/binary)、timeoutMs(number, default 30000)；payload `json`。

- [ ] **Step 7: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add agent/lib/iso8583.js agent/adapters/iso8583.js agent/test/iso8583.test.js agent/adapters/index.js protocols/registry.mjs
git commit -m "feat(agent): add iso 8583 adapter"
```

---

### Task 7: 阶段 3 验收

**Files:**
- Modify: `docs/protocol-lab.md`
- Modify: `README.md`

- [ ] **Step 1: 文档**

写明各协议字段、子集限制（RTMP 不含媒体编解码；RTSP 不含 RTP over UDP；ISO 8583 默认域表；UDS 不支持 Windows）。

- [ ] **Step 2: 完整测试**

```bash
npm run test:unit
npm run test:agent
npm run generate
npx cypress run
```

Expected: 全部通过。

- [ ] **Step 3: 手工验收**

1. Raw Socket TCP/UDP 对 echo 服务各发一次。
2. UDS：`node -e` 起 UDS echo，发送/接收。
3. RTSP：mediamtx 起本地 RTSP，执行 DESCRIBE/SETUP/PLAY，确认 200 与 SDP。
4. RTMP：mediamtx 起 RTMP，play 一个本地流，确认 `_result`/`onStatus` 日志。
5. RTP/RTCP：本地接收端确认头部字段与 RR/SR 日志。
6. ISO 8583：本地 mock 发 0200/回 0210，确认域 39。

- [ ] **Step 4: Commit**

```bash
git add docs/protocol-lab.md README.md
git commit -m "docs: document phase 3 raw and streaming protocols"
```

## 阶段 3 完成标准

- 7 个条目可用；RTSP Digest、ISO 8583 编解码、RTMP 握手有自动化测试。
- 所有适配器在断开后无残留 socket/定时器。
- 构建与全部测试通过。
