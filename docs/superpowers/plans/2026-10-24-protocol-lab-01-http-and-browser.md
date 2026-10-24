# Protocol Lab 阶段 1：HTTP 家族与浏览器能力实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 13 个条目：SOAP、JSON-RPC、XML-RPC、OData、HTTP Binary、HTTP/2、HTTP/3、HLS、WebRTC DataChannel、Webhooks、A2A、MCP、WebSocket 二进制帧。

**Architecture:** HTTP 家族通过 `buildRequest` 构造请求并走现有 `sendNetworkRequest`；Agent 提供 `/proxy/http` 与 WS `http-proxy` 回退。HTTP/2、HTTP/3、Webhooks、MCP stdio 由 Agent 适配器实现；HLS、WebRTC、A2A、MCP remote 在浏览器实现。

**Tech Stack:** Node 18 `http2`、`fetch`、`ws`；浏览器 `hls.js`、WebRTC、Streams；`node:test`、Cypress。

**Spec:** `docs/superpowers/specs/2026-10-24-protocol-lab-design.md`
**共享契约:** `docs/superpowers/plans/2026-10-24-protocol-lab-index.md`
**前置:** 阶段 0 全部任务通过

## Global Constraints

- 沿用阶段 0 的全部约束。
- 新增浏览器依赖必须动态 `import()`，不得进入首屏 bundle。
- HTTP 家族必须尊重现有代理/扩展设置（通过 `sendNetworkRequest`）。
- 二进制响应经扩展/代理拿不到 arraybuffer 时，必须显示明确原因，不得静默显示乱码。
- 页面不向 Agent 传文件路径；`.proto`/IDL 以文本内容发送。
- MCP stdio 只能启动 `agent/config.json` 中配置的 server。
- 单条消息 16 MiB；日志最多 2000 条。

## Review Focus

1. CORS/Origin 拦截的 HTTP 目标：直连失败给出可操作错误，「经 Agent 重试」必须成功（Task 1、Task 12）。
2. 二进制响应经扩展/代理：必须提示不支持，而不是乱码（Task 3）。
3. HTTP/3 运行时不支持：条目必须报「不可用」，不影响其他条目（Task 5）。
4. 非法 JSON-RPC/XML-RPC/OData 输入：必须在校验层报错，不产生未处理 rejection（Task 2）。
5. Webhook 在页面忙碌时到达：Agent 独立接收并推送，事件仍进日志，响应码/响应体按配置返回（Task 10）。

---

### Task 1: Agent HTTP 回退（`/proxy/http` + WS `http-proxy`）

**Files:**
- Create: `agent/lib/fetch-upstream.js`
- Create: `agent/lib/http-proxy.js`
- Create: `agent/adapters/http-proxy.js`
- Modify: `agent/lib/server.js`
- Modify: `agent/adapters/index.js`
- Create: `agent/test/http-proxy.test.js`
- Create: `functions/agent-http.mjs`
- Create: `test/agent-http.test.mjs`

**Interfaces:**
- Consumes: `toBuffer`/`fromBuffer`、信封
- Produces:
  - `POST /proxy/http`：body `{ method, url, headers, data?, encoding }` → `{ status, headers, data, encoding }`；SSE/流式响应直接透传
  - WS 适配器 `http-proxy`：`open({method,url,headers}, emit)`；`send(payload)` 发起请求，emit `data` `{status, headers, encoding, data, bytes}`，随后 `closed`
  - `createAgentFetch({ url, token, fetchImpl? }) -> fetch-like`（页面侧）

- [ ] **Step 1: 写代理失败测试**

`agent/test/http-proxy.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { createAgentServer } = require("../lib/server")

test("proxies a request with token and CORS", async () => {
  const upstream = http.createServer((req, res) => { res.writeHead(201, { "content-type": "text/plain" }); res.end("ok") })
  await new Promise(r => upstream.listen(0, "127.0.0.1", r))
  const target = `http://127.0.0.1:${upstream.address().port}/x`
  const srv = await createAgentServer({ port: 0, token: "t", origins: ["https://postwoman.erik.xyz"], adapters: {} })
  const base = `http://127.0.0.1:${srv.port}`

  const res = await fetch(`${base}/proxy/http`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-agent-token": "t", origin: "https://postwoman.erik.xyz" },
    body: JSON.stringify({ method: "GET", url: target, headers: {} }),
  })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("access-control-allow-origin"), "https://postwoman.erik.xyz")
  assert.deepEqual(await res.json(), { status: 201, headers: { "content-type": "text/plain" }, data: "ok", encoding: "utf8" })

  const denied = await fetch(`${base}/proxy/http`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-agent-token": "bad", origin: "https://postwoman.erik.xyz" },
    body: JSON.stringify({ method: "GET", url: target, headers: {} }),
  })
  assert.equal(denied.status, 401)
  await srv.close(); await new Promise(r => upstream.close(r))
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，`/proxy/http` 返回 404

- [ ] **Step 3: 实现共享上游请求**

`agent/lib/fetch-upstream.js`：

```js
async function fetchUpstream({ method, url, headers, body }) {
  // Node 18 global fetch；返回 { status, headers, body: Node Readable, encoding: "utf8" }
  // 非 2xx 也照常返回，不抛 HTTP 状态错误
}
module.exports = { fetchUpstream }
```

`agent/lib/http-proxy.js`：

- 校验 `x-agent-token`（timing-safe）。
- 校验 Origin 在白名单；响应加 `Access-Control-Allow-Origin`、`Access-Control-Allow-Headers: content-type,x-agent-token`、`Access-Control-Allow-Methods: POST,OPTIONS`。
- `OPTIONS` 返回 204。
- `POST`：body 上限 16 MiB；调用 `fetchUpstream`；普通响应用 `fromBuffer` 返回 JSON；上游 `content-type` 含 `text/event-stream` 时直接把上游流 `pipe` 给客户端（保持 SSE）。
- 错误返回 `{ error }` + 502。

- [ ] **Step 4: 接入服务器与 WS 适配器**

`agent/lib/server.js`：在 HTTP 路由中挂 `/proxy/http`（需要 token 与 origins）。
`agent/adapters/http-proxy.js`：`create(config, emit)` 返回会话；`send(payload)` 调 `fetchUpstream`，emit `data`（`fromBuffer`）后 emit `closed`；`close()` 中止上游（`AbortController`）。
`agent/adapters/index.js` 注册 `http-proxy`。

- [ ] **Step 5: 写页面侧 `createAgentFetch` 失败测试**

`test/agent-http.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { createAgentFetch } from "../functions/agent-http.mjs"
const require = createRequire(import.meta.url)
const { createAgentServer } = require("../agent/lib/server.js")

test("agent fetch posts the envelope and returns the upstream response", async () => {
  const srv = await createAgentServer({ port: 0, token: "t", origins: [], allowNoOrigin: true, adapters: {} })
  const agentFetch = createAgentFetch({ url: `http://127.0.0.1:${srv.port}`, token: "t" })
  const res = await agentFetch("http://example.invalid/", { method: "GET" })
  assert.ok(res instanceof Response || typeof res.status === "number")
  await srv.close()
})
```

测试中的上游用本地 `http.createServer` 替代 `example.invalid`，断言 status/body。

- [ ] **Step 6: 实现 `createAgentFetch`**

`functions/agent-http.mjs`：把标准 fetch 参数编码成 `{method,url,headers,data,encoding}`，POST 到 `${url}/proxy/http`，带上 `X-Agent-Token`；返回代理的 `Response`（保留流）。网络失败时抛出 `Error`，`code = "AGENT_OFFLINE"`。不要把 token 写入日志。

- [ ] **Step 7: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: 新增用例 PASS

- [ ] **Step 8: Commit**

```bash
git add agent/lib/fetch-upstream.js agent/lib/http-proxy.js agent/adapters/http-proxy.js agent/lib/server.js agent/adapters/index.js agent/test/http-proxy.test.js functions/agent-http.mjs test/agent-http.test.mjs
git commit -m "feat(agent): add http proxy fallback"
```

---

### Task 2: SOAP / JSON-RPC / XML-RPC / OData 构建器

**Files:**
- Create: `protocols/builders.mjs`
- Create: `test/builders.test.mjs`
- Modify: `protocols/registry.mjs`（增加 4 个条目）

**Interfaces:**
- Consumes: 注册表契约
- Produces:
  - `buildSoapRequest(fields, payload) -> req`
  - `buildJsonRpcRequest(fields, payload) -> req`
  - `buildXmlRpcRequest(fields, payload) -> req`
  - `buildODataRequest(fields, payload) -> req`
  - `req` 形状见索引

- [ ] **Step 1: 写构建器失败测试**

`test/builders.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { buildSoapRequest, buildJsonRpcRequest, buildXmlRpcRequest, buildODataRequest } from "../protocols/builders.mjs"

test("soap sets action and xml content type", () => {
  const req = buildSoapRequest({ url: "https://x.test/svc", soapAction: "urn:Hi", headers: { A: "b" } }, { encoding: "utf8", data: "<Envelope/>" })
  assert.equal(req.method, "POST")
  assert.equal(req.headers["Content-Type"], "text/xml; charset=utf-8")
  assert.equal(req.headers.SOAPAction, "urn:Hi")
  assert.equal(req.data, "<Envelope/>")
})

test("json-rpc wraps method, params and id", () => {
  const req = buildJsonRpcRequest({ url: "https://x.test/rpc", headers: {} }, { encoding: "utf8", data: '{"a":1}' })
  assert.deepEqual(JSON.parse(req.data), { jsonrpc: "2.0", id: 1, method: "method", params: { a: 1 } })
})

test("xml-rpc escapes params", () => {
  const req = buildXmlRpcRequest({ url: "https://x.test/rpc", method: "m", headers: {} }, { encoding: "utf8", data: '["a<b"]' })
  assert.match(req.data, /<methodName>m<\/methodName>/)
  assert.match(req.data, /<string>a&lt;b<\/string>/)
})

test("odata builds query string and body", () => {
  const req = buildODataRequest({ url: "https://x.test/odata", entitySet: "People", method: "GET", filter: "Age gt 1", top: 5, headers: {} }, null)
  assert.equal(req.url, "https://x.test/odata/People?$filter=Age+gt+1&$top=5")
  assert.equal(req.method, "GET")
})

test("rejects malformed inputs", () => {
  assert.throws(() => buildJsonRpcRequest({ url: "https://x.test/rpc", headers: {} }, { encoding: "utf8", data: "{" }), /JSON/)
  assert.throws(() => buildXmlRpcRequest({ url: "https://x.test/rpc", method: "m", headers: {} }, { encoding: "utf8", data: '[{"a":1}]' }), /unsupported/i)
  assert.throws(() => buildODataRequest({ url: "", entitySet: "", method: "GET", headers: {} }, null), /url/i)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL，找不到 `protocols/builders.mjs`

- [ ] **Step 3: 实现 4 个构建器**

要点：

- SOAP：`POST`，`Content-Type: text/xml; charset=utf-8`，`SOAPAction` 仅在非空时设置；payload 原样发送。`Content-Length` 不手动设置。
- JSON-RPC：`POST`，`Content-Type: application/json`；params 按 JSON 解析（空则为 `[]`），非法 JSON 抛 `Invalid JSON params`；`id` 取字段 `id`（默认 1）。
- XML-RPC：`POST`，`Content-Type: text/xml`；生成 `<methodCall><methodName>…</methodName><params>…</params></methodCall>`；参数只支持 string/int/double/boolean（按 JSON 类型映射），其他抛 `Unsupported XML-RPC parameter type`。
- OData：`url` 与 `entitySet` 必填，缺失抛 `url is required`；拼接 `url.replace(/\/$/,"") + "/" + entitySet`；查询参数按 `$filter/$select/$expand/$orderby/$top/$skip` 顺序追加并 `encodeURIComponent`（空格用 `+`）；非 GET 时 payload 作为 body，`Content-Type: application/json`。

- [ ] **Step 4: 加入注册表**

4 个条目均为 `transport: "http"`、`agentFallback: true`：

| id | label | fields | payload |
|----|-------|--------|---------|
| `soap` | SOAP | url, soapAction, headers(keyvalue) | xml |
| `json-rpc` | JSON-RPC | url, method, id(number, default 1), headers | json |
| `xml-rpc` | XML-RPC | url, method, headers | json |
| `odata` | OData | url, entitySet, method(select), filter, select, expand, orderby, top(number), skip(number), headers | json |

- [ ] **Step 5: 运行测试**

Run: `npm run test:unit`
Expected: PASS；注册表契约测试也通过

- [ ] **Step 6: Commit**

```bash
git add protocols/builders.mjs protocols/registry.mjs test/builders.test.mjs
git commit -m "feat: add soap json-rpc xml-rpc odata builders"
```

---

### Task 3: HTTP/HTTPS Binary Body 与响应归一化

**Files:**
- Create: `test/http-normalize-binary.test.mjs`
- Modify: `protocols/registry.mjs`（`http-binary`）
- Modify: `functions/http-request.js`（二进制响应保留 ArrayBuffer）

**Interfaces:**
- Consumes: `sendHttp`、`editorToWire`、`fromBuffer`
- Produces: `http-binary` 条目；`responseType: "arraybuffer"` 请求

- [ ] **Step 1: 写二进制归一化失败测试**

```js
import test from "node:test"
import assert from "node:assert/strict"
import { normalizeResponse, describeBinaryResponse } from "../functions/http-normalize.mjs"

test("keeps arraybuffer bodies intact", () => {
  const buf = new Uint8Array([0, 1, 255]).buffer
  const out = normalizeResponse({ status: 200, headers: {}, data: buf })
  assert.equal(out.data, buf)
})

test("explains binary responses that came back as text via a proxy", () => {
  assert.equal(describeBinaryResponse(new Uint8Array([1]).buffer, { responseType: "arraybuffer" }).ok, true)
  const bad = describeBinaryResponse("abc", { responseType: "arraybuffer", viaProxy: true })
  assert.equal(bad.ok, false)
  assert.match(bad.message, /代理|扩展/)
})
```

- [ ] **Step 2: 加入 `http-binary` 条目**

字段：`url`、`method`(select: GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS)、`headers`(keyvalue)；payload `binary`。
`buildRequest(fields, payload)`：

```js
{
  method: fields.method,
  url: fields.url,
  headers: fields.headers || {},
  data: payload ? base64ToBytes(payload.data) : undefined,
  responseType: "arraybuffer",
}
```

- [ ] **Step 3: 处理扩展/代理不支持二进制**

在 `lab.vue` 处理 `http-binary` 响应时：

- 在 `functions/http-normalize.mjs` 增加 `describeBinaryResponse(data, { responseType, viaProxy }) -> { ok, message? }`。
- 若 `data` 是 `ArrayBuffer`/`Uint8Array`：按 hexdump 展示。
- 若 `data` 是字符串且 `responseType === "arraybuffer"`：日志显示「当前请求经扩展/代理，二进制响应不可用；请关闭代理/扩展后重试」。
- 不得把字符串当二进制解析。

- [ ] **Step 4: 构建与测试**

Run: `npm run test:unit && npm run generate`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add protocols/registry.mjs functions/http-request.js test/http-normalize-binary.test.mjs components/protocols/lab.vue
git commit -m "feat: add http binary body entry"
```

---

### Task 4: HTTP/2 适配器

**Files:**
- Create: `agent/adapters/http2.js`
- Create: `agent/test/http2.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `protocols/registry.mjs`（`http2`）

**Interfaces:**
- Consumes: `fromBuffer`、适配器接口
- Produces: 适配器 `http2`；config `{ url, method, headers, allowSelfSigned }`；`ready: { protocol: "h2" }`

- [ ] **Step 1: 写 HTTP/2 失败测试**

启动 `http2.createServer()`（h2c），对 `/` 返回 `204`/JSON；适配器 `create({url: http://127.0.0.1:port/, method:"GET", headers:{}})`；`send(empty)` 后断言收到 `data` 含响应体、`ready.protocol === "h2"`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，找不到 `../adapters/http2`

- [ ] **Step 3: 实现适配器**

- `http2.connect(origin, { rejectUnauthorized: !allowSelfSigned })`。
- 请求头：`:method`、`:path`（含 query）、用户 headers；不发送 `connection`/`transfer-encoding` 等非法 h2 头。
- 收集 `response` 事件的 headers、`data` 事件的 chunk、`end` 事件；emit 一次 `data`（合并 body，`fromBuffer`），随后 `closed`。
- 30 秒超时；`close()` 销毁 session。
- `ready` 返回 `{ protocol: "h2" }`。

- [ ] **Step 4: 加入注册表**

`http2` 条目：`transport: "agent"`，fields `url`、`method`、`headers`、`allowSelfSigned`(checkbox)，payload `binary`，actions `["connect","send","close"]`。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent/adapters/http2.js agent/adapters/index.js agent/test/http2.test.js protocols/registry.mjs
git commit -m "feat(agent): add http/2 adapter"
```

---

### Task 5: HTTP/3 适配器（可用性探测）

**Files:**
- Create: `agent/adapters/http3.js`
- Create: `agent/test/http3.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`（可选依赖）
- Modify: `protocols/registry.mjs`（`http3`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: 适配器接口
- Produces: 适配器 `http3`；不可用时抛 `Error("HTTP/3 is not available in this runtime")`，`code = "UNSUPPORTED"`

- [ ] **Step 1: 先做兼容性 spike**

Run:

```bash
npm view @currentspace/http3 engines version
npm --prefix agent install @currentspace/http3 --save-optional
node -e "try { require('@currentspace/http3'); console.log('loaded') } catch (e) { console.log('unavailable:', e.message) }"
```

记录 Node 18 是否能加载。若不能加载，保留 optional 依赖并走「明确不可用」路径；不要升级 Node。

- [ ] **Step 2: 写可用性测试**

`agent/test/http3.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const http3 = require("../adapters/http3")

test("fails clearly when the runtime lacks HTTP/3", async () => {
  try {
    await http3.create({ url: "https://example.test/", method: "GET", headers: {} }, () => {})
    assert.fail("expected unsupported error")
  } catch (e) {
    assert.match(e.message, /HTTP\/3 is not available|ECONNREFUSED|ENOTFOUND/i)
  }
})
```

- [ ] **Step 3: 实现适配器**

- 尝试 `require("@currentspace/http3")`；捕获 `MODULE_NOT_FOUND` 或初始化错误，抛出带 `code:"UNSUPPORTED"` 的 Error。
- 可用时：发起 h3 请求，方法/headers/body 与 `http2` 一致；emit `ready: { protocol: "h3" }`，收到响应后 emit `data` + `closed`。
- 30 秒超时；`close()` 取消。

- [ ] **Step 4: 加入注册表与文档**

`http3` 条目与 `http2` 字段一致。`docs/protocol-lab.md` 写明：Node 18 无内置 QUIC；库不可用时条目报不可用；浏览器 HTTPS 会自动协商 HTTP/3。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent`
Expected: PASS（不可用路径）

- [ ] **Step 6: Commit**

```bash
git add agent/adapters/http3.js agent/adapters/index.js agent/package.json agent/test/http3.test.js protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add http/3 adapter with availability probe"
```

---

### Task 6: WebSocket 二进制帧

**Files:**
- Modify: `components/realtime/websocket.vue`
- Modify: `tests/protocols.spec.js`（新增用例）
- Modify: `lang/en-US.json`（`binary`, `text`）

**Interfaces:**
- Consumes: `hexToBytes`, `toHexDump`
- Produces: 现有 WebSocket 页面增加 `binaryMode` 开关；二进制收发按 hex 展示

- [ ] **Step 1: 写 Cypress 失败测试**

```js
it("toggles websocket binary mode", () => {
  cy.visit("/realtime")
  cy.contains(/binary/i).click()
  cy.contains(/text/i)
})
```

- [ ] **Step 2: 修改组件**

- `data()` 增加 `binaryMode: false`。
- 请求区增加一个 select 或 toggle：`Text` / `Binary`；切换时清空当前输入并更新占位提示。
- `connect()` 中 `this.socket.binaryType = "arraybuffer"`。
- `sendMessage()`：二进制模式下用 `hexToBytes(this.communication.input)`（非法 hex → toast + 不发送），`socket.send(bytes.buffer)`；文本模式保持原逻辑。
- `onmessage`：若 `event.data` 是 `ArrayBuffer`，日志 payload 用 `toHexDump(new Uint8Array(event.data))`；否则原样。
- `disconnect()` 不做额外改动。

- [ ] **Step 3: 运行 e2e 与构建**

Run: `npm run generate && npx cypress run --spec tests/protocols.spec.js`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/realtime/websocket.vue tests/protocols.spec.js lang/en-US.json
git commit -m "feat(realtime): add websocket binary frame mode"
```

---

### Task 7: A2A 客户端与面板

**Files:**
- Create: `functions/a2a.mjs`
- Create: `test/a2a.test.mjs`
- Create: `components/protocols/panels/a2a.vue`
- Modify: `protocols/registry.mjs`（`a2a`）
- Modify: `lang/en-US.json`（`agent_card`, `send_message`, `context_id`）

**Interfaces:**
- Consumes: `createAgentFetch`（可选回退）
- Produces:
  - `fetchAgentCard(baseUrl, { fetchImpl }) -> object`
  - `sendA2AMessage({ endpoint, message, contextId, fetchImpl }) -> object`
  - `parseSse(response, onEvent) -> Promise<void>`
  - `a2a` 条目：`transport:"browser"`, `panel:"a2a"`, `agentFallback:true`

- [ ] **Step 1: 写 A2A 失败测试**

`test/a2a.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { fetchAgentCard, sendA2AMessage, parseSse } from "../functions/a2a.mjs"

test("fetches the agent card from well-known path", async () => {
  const calls = []
  const fetchImpl = async url => { calls.push(url); return new Response(JSON.stringify({ name: "x" }), { status: 200 }) }
  assert.deepEqual(await fetchAgentCard("https://a.test", { fetchImpl }), { name: "x" })
  assert.equal(calls[0], "https://a.test/.well-known/agent-card.json")
})

test("sends a JSON-RPC message/send", async () => {
  let body
  const fetchImpl = async (_url, init) => { body = JSON.parse(init.body); return new Response("{}", { status: 200 }) }
  await sendA2AMessage({ endpoint: "https://a.test/rpc", message: "hi", contextId: "c1", fetchImpl })
  assert.equal(body.method, "message/send")
  assert.equal(body.params.message.parts[0].text, "hi")
  assert.equal(body.params.contextId, "c1")
})

test("parses multi-line SSE events", async () => {
  const stream = new Response("data: {\"a\":1}\n\ndata: {\"b\":2}\n\n").body
  const events = []
  await parseSse(new Response(stream), e => events.push(e))
  assert.deepEqual(events, [{ a: 1 }, { b: 2 }])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL

- [ ] **Step 3: 实现客户端**

- Agent Card 路径默认 `/.well-known/agent-card.json`；允许多段 `data:` 行拼接；忽略注释与空行。
- `sendA2AMessage` 构造 A2A 1.0 风格的 `message/send`；`message` 为 `{ role:"user", parts:[{kind:"text", text}] }`，`messageId` 用 `crypto.randomUUID()`（浏览器/Node 18 都有）。
- 非 2xx 抛错并带状态与响应文本。

- [ ] **Step 4: 实现面板**

`panels/a2a.vue`：

- 字段：Agent 基础 URL、消息文本、contextId（可选）。
- 按钮：Fetch Card、Send；SSE 流可选（若响应 `content-type: text/event-stream`，用 `parseSse` 逐条追加）。
- 日志复用 `log.vue`。
- 失败时显示「经 Agent 重试」开关：打开后用 `createAgentFetch` 注入 `fetchImpl`。
- registry 条目 `a2a`：fields `baseUrl`、`message`、`contextId`；`payload:"none"`。

- [ ] **Step 5: 运行测试与构建**

Run: `npm run test:unit && npm run generate`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/a2a.mjs test/a2a.test.mjs components/protocols/panels/a2a.vue protocols/registry.mjs lang/en-US.json
git commit -m "feat: add a2a client and panel"
```

---

### Task 8: MCP 远程客户端与面板

**Files:**
- Create: `functions/mcp-remote.mjs`
- Create: `test/mcp-remote.test.mjs`
- Create: `components/protocols/panels/mcp.vue`
- Modify: `protocols/registry.mjs`（`mcp`）
- Modify: `lang/en-US.json`（`tools`, `resources`, `prompts`, `call_tool`）

**Interfaces:**
- Consumes: `createAgentFetch`（回退）
- Produces:
  - `class McpRemoteClient { constructor({url, headers, fetchImpl}); initialize(); listTools(); callTool(name, args); listResources(); listPrompts(); close() }`
  - `mcp` 条目：`transport:"browser"`, `panel:"mcp"`, `agentFallback:true`

- [ ] **Step 1: 写 MCP 失败测试**

`test/mcp-remote.test.mjs`：

```js
import test from "node:test"
import assert from "node:assert/strict"
import { McpRemoteClient } from "../functions/mcp-remote.mjs"

test("initializes, keeps session id and lists tools", async () => {
  const seen = []
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body)
    seen.push({ url, body, headers: init.headers })
    if (body.method === "initialize") {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2024-11-05" } }), {
        status: 200, headers: { "mcp-session-id": "s1", "content-type": "application/json" },
      })
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "echo" }] } }), { status: 200 })
  }
  const c = new McpRemoteClient({ url: "https://m.test/mcp", headers: {}, fetchImpl })
  await c.initialize()
  assert.equal(seen[0].headers["mcp-session-id"], undefined)
  assert.equal(seen[1].headers["mcp-session-id"], "s1")
  assert.deepEqual(await c.listTools(), [{ name: "echo" }])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:unit`
Expected: FAIL

- [ ] **Step 3: 实现客户端**

- `initialize` 发送 `initialize`，保存 `Mcp-Session-Id` 响应头，再发送 `notifications/initialized`（无 id，无需等响应）。
- 后续请求带 `Mcp-Session-Id`、`Accept: application/json, text/event-stream`。
- 解析响应：`application/json` 直接取 JSON；`text/event-stream` 用 `parseSse` 取第一个带 `result`/`error` 的消息。
- JSON-RPC `error` 转成 Error，保留 `code`/`data`。
- 请求 id 自增；超时 30 秒。

- [ ] **Step 4: 实现面板与注册表**

面板字段：URL、headers(keyvalue)、transport(select: remote/stdio)。远程：
连接 → initialize → listTools/listResources/listPrompts；工具下拉 + args JSON → callTool；日志显示 JSON-RPC。
失败时提供「经 Agent 重试」（`createAgentFetch`）。
stdio 在 Task 9 接线，本任务先禁用并提示。

registry `mcp`：fields `url`、`headers`、`transport`；payload `none`；panel `mcp`。

- [ ] **Step 5: 运行测试与构建**

Run: `npm run test:unit && npm run generate`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add functions/mcp-remote.mjs test/mcp-remote.test.mjs components/protocols/panels/mcp.vue protocols/registry.mjs lang/en-US.json
git commit -m "feat: add mcp remote client and panel"
```

---

### Task 9: MCP stdio 适配器

**Files:**
- Create: `agent/adapters/mcp-stdio.js`
- Create: `agent/test/fixtures/mcp-server.js`
- Create: `agent/test/mcp-stdio.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/lib/server.js`（把 `mcpServers` 放入 `context`）
- Modify: `agent/index.js`（`--config` 加载）
- Modify: `components/protocols/panels/mcp.vue`（stdio 接线）

**Interfaces:**
- Consumes: `agent/config.json` 的 `mcpServers`
- Produces: 适配器 `mcp-stdio`；config `{ server: "<name>" }`；`ready: { name }`

- [ ] **Step 1: 写 fixture MCP server**

`agent/test/fixtures/mcp-server.js`：从 stdin 按行读 JSON-RPC；对 `initialize` 返回 `{protocolVersion:"2024-11-05", capabilities:{tools:{}}, serverInfo:{name:"fixture", version:"0"}}`；对 `tools/list` 返回 `[{name:"echo"}]`；对 `tools/call` 返回 `{content:[{type:"text",text:args.text}]}`；对 `notifications/initialized` 不响应。

- [ ] **Step 2: 写适配器失败测试**

`agent/test/mcp-stdio.test.js`：启动 `createAgentServer` 并传 `config: { mcpServers: { fixture: { command: process.execPath, args: ["test/fixtures/mcp-server.js"] } } }`；通过 WS 客户端 `open("mcp-stdio", { server:"fixture" })`，发送 initialize 请求，断言返回 fixture 信息；发送 `tools/call`，断言结果；`close` 后子进程退出。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，`unknown protocol mcp-stdio`

- [ ] **Step 4: 实现适配器**

- 从 `context.mcpServers[server]` 取命令；不存在则抛错。
- `spawn(command, args, { env: { ...process.env, ...cfg.env }, shell: false, stdio: ["pipe","pipe","pipe"] })`。
- `stdout` 按行切 JSON；按 `id` 匹配 pending；emit `data` `{encoding:"utf8", data: JSON.stringify(msg)}`。
- `stderr` 作为 `log`（level warn）。
- `send(payload)`：解析 JSON，写一行；`close()` kill 子进程（先 SIGTERM，2 秒后 SIGKILL），幂等。
- 进程退出时 emit `closed`。
- 不向页面暴露命令、路径或环境变量。

- [ ] **Step 5: 在面板接线**

`mcp.vue` 选择 `stdio` 时：从 Agent 获取已配置 server 列表？本阶段先用文本框填 server 名（页面不能新增命令）；连接调用 `agentClient.open("mcp-stdio", { server })`；后续请求走 Agent `send`，按 id 匹配响应。日志显示 JSON-RPC。

- [ ] **Step 6: 运行测试与构建**

Run: `npm run test:agent && npm run generate`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add agent/adapters/mcp-stdio.js agent/test/fixtures/mcp-server.js agent/test/mcp-stdio.test.js agent/adapters/index.js agent/lib/server.js agent/index.js components/protocols/panels/mcp.vue
git commit -m "feat(agent): add mcp stdio adapter"
```

---

### Task 10: Webhooks 入站

**Files:**
- Create: `agent/adapters/webhooks.js`
- Create: `agent/lib/hooks.js`
- Create: `agent/test/webhooks.test.js`
- Modify: `agent/lib/server.js`
- Modify: `agent/adapters/index.js`
- Create: `components/protocols/panels/webhooks.vue`
- Modify: `protocols/registry.mjs`（`webhooks`）
- Modify: `lang/en-US.json`（`hook_url`, `respond_with`）

**Interfaces:**
- Consumes: 会话管理器、HTTP 路由
- Produces: 适配器 `webhooks`；`ready: { url: "http://127.0.0.1:<port>/hook/<secret>" }`；config `{ responseCode, responseBody }`

- [ ] **Step 1: 写 Webhooks 失败测试**

`agent/test/webhooks.test.js`：启动 server（含 webhooks 适配器），打开会话拿到 `ready.url`；用 `fetch(url, {method:"POST", body:"hi"})`，断言：
- 响应码为配置的 `201`，body 为 `ok`；
- 会话收到 `data` 事件，payload 含 `method:"POST"`、`body:"hi"`、headers。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，未知协议

- [ ] **Step 3: 实现**

`agent/lib/hooks.js`：导出 `createHookRouter()`，提供 `register(secret, handler)`、`unregister(secret)`、`handle(req,res)`；后者匹配 `/hook/` 前缀，找不到返回 404。
`agent/adapters/webhooks.js`：`create(config, emit, context)` 生成 `crypto.randomBytes(16).toString("hex")`，通过 `context.hookRouter.register(secret, handler)` 注册，收集 body（上限 16 MiB），emit `data` `{ encoding:"base64", data: base64, bytes, method, url, headers }`；按 config 返回 `responseCode`（默认 200）与 `responseBody`（默认 `""`）；`ready` 返回 `{ url: \`http://127.0.0.1:${context.port}/hook/${secret}\` }`；`close()` 注销 secret。
`server.js`：覆盖 `createAgentServer({ hookRouter })` 或创建默认 router，并在 HTTP 路由最前面调用 `hookRouter.handle`。

- [ ] **Step 4: 实现面板**

面板显示 URL（可复制）、响应码/响应体字段、收到的请求日志（method/headers/body）。字段变化时通过 `agentClient.send` 更新？适配器 config 在 open 时固定；本阶段要求先填响应码/响应体再连接，连接后修改需重连。面板明确提示。

registry `webhooks`：fields `responseCode`(number, default 200)、`responseBody`(textarea)；payload `none`；panel `webhooks`；transport `agent`。

- [ ] **Step 5: 运行测试与构建**

Run: `npm run test:agent && npm run test:unit && npm run generate`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent/adapters/webhooks.js agent/lib/hooks.js agent/lib/server.js agent/adapters/index.js agent/test/webhooks.test.js components/protocols/panels/webhooks.vue protocols/registry.mjs lang/en-US.json
git commit -m "feat: add webhooks inbound receiver"
```

---

### Task 11: HLS 面板

**Files:**
- Create: `components/protocols/panels/hls.vue`
- Modify: `protocols/registry.mjs`（`hls`）
- Modify: `package.json`（`hls.js`）
- Create: `tests/hls.spec.js`

**Interfaces:**
- Consumes: `hls.js`（动态 import）
- Produces: `hls` 条目：`transport:"browser"`, `panel:"hls"`

- [ ] **Step 1: 安装依赖**

Run: `npm install hls.js@^1.5.0`
Expected: 加入 dependencies；不改 lockfile 版本策略

- [ ] **Step 2: 写 Cypress 失败测试**

`tests/hls.spec.js`：

```js
describe("HLS panel", () => {
  it("renders a URL field and reports an invalid playlist", () => {
    cy.visit("/protocols")
    cy.contains("HLS").click()
    cy.get('input[type="url"]').type("http://127.0.0.1:1/nope.m3u8")
    cy.contains(/load|error/i).click()
    cy.contains(/error|failed/i, { timeout: 10000 })
  })
})
```

- [ ] **Step 3: 实现面板**

- 字段：playlist URL、autoplay（checkbox）。
- 动态 `import("hls.js")`；`Hls.isSupported()` 则 `new Hls()`，`loadSource`，`attachMedia(video)`；Safari 原生则 `video.src = url`。
- 事件日志：`MANIFEST_PARSED`（levels 数量、分辨率/码率）、`LEVEL_SWITCHED`、`FRAG_LOADED`、`ERROR`。
- `beforeDestroy`：`hls.destroy()`。
- 不处理 DRM。

registry `hls`：fields `url`、`autoplay`；payload `none`；panel `hls`。

- [ ] **Step 4: 运行构建与 e2e**

Run: `npm run generate && npx cypress run --spec tests/hls.spec.js`
Expected: PASS（错误路径）

- [ ] **Step 5: Commit**

```bash
git add components/protocols/panels/hls.vue protocols/registry.mjs package.json package-lock.json tests/hls.spec.js
git commit -m "feat: add hls debug panel"
```

---

### Task 12: WebRTC DataChannel 面板

**Files:**
- Create: `components/protocols/panels/webrtc.vue`
- Modify: `protocols/registry.mjs`（`webrtc`）
- Create: `tests/webrtc.spec.js`

**Interfaces:**
- Consumes: 浏览器 `RTCPeerConnection`
- Produces: `webrtc` 条目：`transport:"browser"`, `panel:"webrtc"`

- [ ] **Step 1: 写 Cypress loopback 失败测试**

```js
describe("WebRTC panel", () => {
  it("sends a message over a loopback data channel", () => {
    cy.visit("/protocols")
    cy.contains("WebRTC").click()
    cy.contains(/start loopback/i).click()
    cy.get('[data-test="webrtc-input"]').type("hello")
    cy.contains(/send/i).click()
    cy.contains("hello", { timeout: 10000 })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run dev` 后 `npx cypress run --spec tests/webrtc.spec.js`
Expected: FAIL，页面不存在

- [ ] **Step 3: 实现面板**

- 模式：Loopback / Manual SDP。
- Loopback：创建两个 `RTCPeerConnection`（可配置 STUN URL，默认空），`pc1` 建 data channel，交换 offer/answer/ICE；`onmessage` 追加日志；发送文本/hex。
- Manual：生成 offer / 粘贴远端 answer；ICE candidate 文本域可复制。
- 日志：ICE 状态、候选、通道 open/close、消息方向。
- `beforeDestroy`：关闭两个 pc 和通道。

registry `webrtc`：fields `mode`(select)、`stun`(text)、`remoteSdp`(textarea)；payload `binary`；panel `webrtc`。

- [ ] **Step 4: 运行 e2e**

Run: `npm run generate && npx cypress run --spec tests/webrtc.spec.js`
Expected: PASS（若 Electron 不支持 WebRTC，改用 `--browser chrome`，并在文档记录）

- [ ] **Step 5: Commit**

```bash
git add components/protocols/panels/webrtc.vue protocols/registry.mjs tests/webrtc.spec.js
git commit -m "feat: add webrtc datachannel panel"
```

---

### Task 13: 「经 Agent 重试」统一接线

**Files:**
- Modify: `components/protocols/lab.vue`
- Modify: `components/protocols/panels/a2a.vue`
- Modify: `components/protocols/panels/mcp.vue`
- Modify: `lang/en-US.json`（`retry_via_agent`, `via_agent`）
- Create: `test/agent-fallback.test.mjs`

**Interfaces:**
- Consumes: `createAgentFetch`、`agentClient`
- Produces: HTTP 家族失败后一键重试；A2A/MCP 面板的 `via Agent` 开关

- [ ] **Step 1: 写回退状态测试**

`test/agent-fallback.test.mjs`：断言 `createAgentFetch` 在 Agent 不可达时抛出带 `AGENT_OFFLINE` 的错误；在 Agent 可达且上游成功时返回结果。用 `createAgentServer` 搭本地环境。

- [ ] **Step 2: 修改 lab.vue**

- HTTP 家族发送 catch 中判断错误类型：网络错误、CORS（`TypeError: Failed to fetch`）→ 日志附「经 Agent 重试」按钮。
- 按钮仅在 `agentClient.status === "connected"` 时可用；点击后用 `agentClient.open("http-proxy", { method, url, headers })` + `send(payload)`，把 `data` 事件写入日志。
- 明确标注本次请求是「直连」还是「经 Agent」。

- [ ] **Step 3: 修改 A2A/MCP 面板**

- 增加 `via Agent` 开关；开启后把 `fetchImpl` 换成 `createAgentFetch({ url: agentHttpBase, token })`。
- Agent 未连接时开关禁用，并提示先连接。
- `agentHttpBase` 与 token 从设置页同一来源读取（`localStorage`/`sessionStorage`）。

- [ ] **Step 4: 运行测试与构建**

Run: `npm run test:unit && npm run test:agent && npm run generate`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/protocols/lab.vue components/protocols/panels/a2a.vue components/protocols/panels/mcp.vue lang/en-US.json test/agent-fallback.test.mjs
git commit -m "feat: add agent fallback for browser protocols"
```

---

### Task 14: 阶段 1 验收

**Files:**
- Modify: `docs/protocol-lab.md`
- Modify: `README.md`

- [ ] **Step 1: 更新文档**

写明 13 个条目的使用方式、子集限制（HTTP/3 运行时依赖、MCP 远程不支持 server reflection、WebRTC TURN 不做、HLS 不做 DRM）、CORS 回退说明。

- [ ] **Step 2: 跑完整测试**

```bash
npm run test:unit
npm run test:agent
npm run generate
npx cypress run
```

Expected: 全部通过。

- [ ] **Step 3: 手工验收**

1. SOAP/JSON-RPC/XML-RPC/OData 各对一个本地 mock（可用 `npx http-echo-server` 或 `node -e`）发一次请求，确认 body/header 正确。
2. HTTP/2：`node -e` 起 h2c echo，确认响应正确。
3. HTTP/3：运行不可用路径，确认提示清晰；若库可用，对 `https://cloudflare-quic.com` 手工验证。
4. Webhooks：用 `curl -X POST <hook-url> -d hi`，确认响应码/响应体与日志。
5. A2A/MCP：用本地 mock 或公网测试端点；CORS 失败时用「经 Agent 重试」。
6. HLS：用公开 m3u8 手工验证播放列表与分片日志。
7. WebRTC：loopback 文本/二进制各一条。
8. WebSocket 二进制帧：对 `wss://echo.websocket.org` 发 hex，确认回显。

- [ ] **Step 4: Commit**

```bash
git add docs/protocol-lab.md README.md
git commit -m "docs: document phase 1 protocols"
```

## 阶段 1 完成标准

- 13 个条目全部出现在 `/protocols` 并可操作（HTTP/3 允许显示「运行时不可用」）。
- CORS 目标的「经 Agent 重试」可用。
- 二进制 HTTP 响应在直连路径正确、在代理路径有明确提示。
- 现有测试与新增测试全绿，构建通过。
