# Protocol Lab 阶段 4：RPC 与消息队列实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 gRPC、Dubbo、Thrift、Hessian、AMQP、Kafka、STOMP (TCP) 七个条目。

**Architecture:** 全部由 Agent 适配器实现。gRPC 用 `@grpc/grpc-js`，Thrift 用 `thrift`，Hessian/Dubbo 用 `hessian.js`，AMQP 用 `amqplib`，Kafka 用 `kafkajs`，STOMP-TCP 用自写的最小帧编解码。

**Tech Stack:** Node 18 + 上述库；`node:test`；需要 broker 的集成测试用环境变量启用。

**Spec:** `docs/superpowers/specs/2026-10-24-protocol-lab-design.md`
**共享契约:** `docs/superpowers/plans/2026-10-24-protocol-lab-index.md`
**前置:** 阶段 0–3 全部任务通过

## Global Constraints

- 沿用阶段 0–3 的全部约束。
- 新依赖只加到 `agent/package.json`，不进入 Nuxt 构建。
- 证书默认校验证书；`allowSelfSigned` 只做逐连接显式开关。
- 页面只发送 IDL/`.proto` 的文本内容；Agent 写临时文件后必须删除（`finally`）。
- 需要 broker 的测试在无 `AMQP_URL` / `KAFKA_BROKERS` 时 `test.skip`，不能阻塞 CI。
- 日志与消息缓冲上限 16 MiB；消费端必须限制内存（最多保留 2000 条日志）。

## Review Focus

1. broker 不可达：连接在 30 秒内失败并给出可操作错误，不无限重连（Task 5、Task 6）。
2. gRPC `.proto` 解析失败：错误包含行列信息，不启动半连接客户端（Task 1）。
3. Thrift IDL 不支持的类型：明确报错并指出类型名，不静默跳过（Task 3）。
4. Kafka 消费积压/大消息：日志有上限、每条消息只保留必要内容，内存不随积压增长（Task 6）。
5. AMQP publish 到不存在的 exchange：显示 broker 错误，channel 不泄漏（Task 5）。

---

### Task 1: gRPC 适配器

**Files:**
- Create: `agent/adapters/grpc.js`
- Create: `agent/test/fixtures/echo.proto`
- Create: `agent/test/grpc.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`
- Modify: `protocols/registry.mjs`（`grpc`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `@grpc/grpc-js`、`@grpc/proto-loader`
- Produces: 适配器 `grpc`；config `{ target, proto, service, method, metadata, tls, allowSelfSigned, timeoutMs }`；`ready: { service, method, streaming }`

- [ ] **Step 1: 安装依赖**

Run: `npm --prefix agent install @grpc/grpc-js @grpc/proto-loader`

- [ ] **Step 2: 写 fixture proto 与测试**

`agent/test/fixtures/echo.proto`：

```proto
syntax = "proto3";
package test;
service Echo {
  rpc Unary (Msg) returns (Msg);
  rpc Stream (Msg) returns (stream Msg);
}
message Msg { string text = 1; }
```

`agent/test/grpc.test.js`：
- 启动 gRPC server（同一 proto，端口 0），Unary 返回 `text: "echo:" + req.text`，Stream 依次返回 3 条。
- 适配器 `create({ target:"127.0.0.1:<port>", proto:<文件内容>, service:"test.Echo", method:"Unary", tls:false }, emit)`；`send({encoding:"utf8",data:'{"text":"hi"}'})`；断言收到 `echo:hi`。
- Stream 方法：断言收到 3 条 data 后 closed。
- 非法 proto：`create` 抛错，错误包含 `line` 或 `column`。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，未知协议 `grpc`

- [ ] **Step 4: 实现适配器**

- 把 `config.proto` 写到 `os.tmpdir()/postwoman-<random>.proto`，`proto-loader.loadSync(file, { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true })`；`finally` 删除文件。
- `grpc.loadPackageDefinition` 后按 `service` 全名查找；找不到抛 `Service <name> not found`。
- 方法：`method` 名称必须存在；判断 `requestStream`/`responseStream`。只支持 unary 与 server streaming；client/bidi streaming 抛 `Unsupported method type`。
- 凭证：`tls` 为 true 时 `grpc.credentials.createSsl(null, null, null, { rejectUnauthorized: !allowSelfSigned })`；否则 `createInsecure()`。
- 调用：unary 用 callback；server streaming 用可读流；把响应 JSON emit 为 `data`，结束后 `closed`。metadata 用 `grpc.Metadata`。
- `close()` 取消调用/关闭 client；30 秒超时。

- [ ] **Step 5: 注册表条目**

`grpc`：fields `target`、`proto`(textarea)、`service`、`method`、`metadata`(keyvalue)、`tls`(checkbox)、`allowSelfSigned`(checkbox)；payload `json`。

- [ ] **Step 6: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add agent/adapters/grpc.js agent/test/fixtures/echo.proto agent/test/grpc.test.js agent/adapters/index.js agent/package.json agent/package-lock.json protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add grpc adapter"
```

---

### Task 2: Dubbo 适配器（Hessian2）

**Files:**
- Create: `agent/lib/dubbo.js`
- Create: `agent/adapters/dubbo.js`
- Create: `agent/test/dubbo.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`
- Modify: `protocols/registry.mjs`（`dubbo`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `hessian.js`、`net`
- Produces:
  - `encodeDubboRequest({ requestId, interfaceName, version, method, parameterTypes, args }) -> Buffer`
  - `decodeDubboResponse(buffer) -> { requestId, status, result }`
  - 适配器 `dubbo`；config `{ host, port, interface, version, method, parameterTypes: string, args, timeoutMs }`

- [ ] **Step 1: 安装依赖**

Run: `npm --prefix agent install hessian.js`

- [ ] **Step 2: 写编解码失败测试**

`agent/test/dubbo.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const { encodeDubboRequest, decodeDubboResponse } = require("../lib/dubbo")

test("encodes magic, request id and hessian2 body", () => {
  const buf = encodeDubboRequest({ requestId: 7, interfaceName: "com.x.S", version: "1.0.0", method: "hi", parameterTypes: ["java.lang.String"], args: ["a"] })
  assert.equal(buf.readUInt16BE(0), 0xdabb)
  assert.equal(buf[2] & 0x80, 0x80)
  assert.equal(buf.readBigInt64BE(4), 7n)
  assert.equal(buf.readUInt32BE(12), buf.length - 16)
})

test("decodes a canned success response", () => {
  // 测试内用 hessian 库构造 status=20、body = [null, "ok"]
  // 断言 decodeDubboResponse 返回 { status: 20, result: "ok" }
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 4: 实现 `agent/lib/dubbo.js`**

- Header：magic `0xdabb`；flag `0xc2`（request + two-way + hessian2 serialization）；status 0；request id 8 字节 big-endian；body length 4 字节。
- Body：Hessian2 数组 `[dubboVersion "2.0.2", interfaceName, version, method, parameterTypes, ...args]`；用 `hessian.js` encoder。
- 响应：flag 的 request 位为 0；status 20 为 OK，其余为错误；body Hessian2 解码，返回 `result` 或 `exception`。
- 超过 16 MiB 或长度不匹配抛错。

- [ ] **Step 5: 实现适配器与 mock 测试**

- `create`：`net.connect`；`send`：编码并写入；按 header 的 body length 切响应；解码后 emit `data` JSON；错误 status emit `error`。
- mock 服务器：读 16 字节 header，按 length 读 body，返回 header + Hessian2 响应。测试 unary 成功与异常两条路径。
- `close()` 销毁 socket；30 秒超时。

- [ ] **Step 6: 注册表条目**

`dubbo`：fields `host`、`port`、`interface`、`version`(default `1.0.0`)、`method`、`parameterTypes`(text, 逗号分隔)、`args`(json)；payload `json`。

- [ ] **Step 7: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add agent/lib/dubbo.js agent/adapters/dubbo.js agent/test/dubbo.test.js agent/adapters/index.js agent/package.json agent/package-lock.json protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add dubbo adapter"
```

---

### Task 3: Thrift 适配器

**Files:**
- Create: `agent/lib/thrift-idl.js`
- Create: `agent/adapters/thrift.js`
- Create: `agent/test/thrift.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`
- Modify: `protocols/registry.mjs`（`thrift`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `thrift`、IDL 解析器（`@creditkarma/thrift-parser` 或等价）
- Produces:
  - `parseThriftIdl(source) -> { services: { [name]: { methods: [{ name, args: [{name, type}] }] } }, structs }`
  - `encodeThriftCall({ service, method, args, proto }) -> Buffer`
  - `decodeThriftResult(buffer, { method, proto }) -> value`
  - 适配器 `thrift`；config `{ host, port, idl, service, method, args, timeoutMs }`

- [ ] **Step 1: 先做解析器 spike**

Run:

```bash
npm --prefix agent install thrift @creditkarma/thrift-parser
node -e "const p=require('@creditkarma/thrift-parser'); console.log(typeof p.parse)"
```

若库不可用或 API 不符，改用 `thrift-parser` 或写最小词法解析（只支持 `service`/`struct`/基本类型/list/map）。记录选择。

- [ ] **Step 2: 写 IDL 解析失败测试**

`agent/test/thrift.test.js`：

```js
const test = require("node:test")
const assert = require("node:assert/strict")
const { parseThriftIdl } = require("../lib/thrift-idl")

const IDL = `
namespace js test
service Echo {
  string echo(1: string text)
}
`
test("parses services and method args", () => {
  const out = parseThriftIdl(IDL)
  assert.equal(out.services.Echo.methods[0].name, "echo")
  assert.deepEqual(out.services.Echo.methods[0].args, [{ name: "text", type: "string" }])
})

test("rejects unsupported thrift types", () => {
  assert.throws(() => parseThriftIdl("service S { string m(1: uuid x) }"), /Unsupported Thrift type uuid/i)
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 4: 实现 IDL 与编解码**

- 支持类型：`bool`、`byte`/`i8`、`i16`、`i32`、`i64`、`double`、`string`、`list<T>`、`map<K,V>`、`set<T>`、已定义 `struct`。
- 用 `thrift.TBinaryProtocol` + `TBufferedTransport` 在内存中写：`writeMessageBegin(name, CALL, seqid)` → `writeStructBegin` → 每个参数 `writeFieldBegin` + 对应 `write*` → `writeFieldStop` → `writeStructEnd` → `writeMessageEnd`。
- 解码：跳过结果 struct 的字段，取 field id 0 为 success；非 0 为 exception，抛错并带方法名。
- 不支持的类型抛 `Unsupported Thrift type <name>`。

- [ ] **Step 5: 实现适配器与 fixture 服务器**

- 适配器：`net.connect`；`send` 时编码 args（JSON 对象 → 参数顺序按 IDL 定义）；读响应长度（TBinaryProtocol 无长度头，按到达数据解码；一次响应一个包）。
- fixture 服务器：用 `thrift` 库读 message/struct，回复 `echo` 结果；测试成功与 exception。
- `close()` 销毁 socket；30 秒超时。

- [ ] **Step 6: 注册表条目**

`thrift`：fields `host`、`port`、`idl`(textarea)、`service`、`method`、`args`(json)；payload `json`。

- [ ] **Step 7: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add agent/lib/thrift-idl.js agent/adapters/thrift.js agent/test/thrift.test.js agent/adapters/index.js agent/package.json agent/package-lock.json protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add thrift adapter"
```

---

### Task 4: Hessian 适配器

**Files:**
- Create: `agent/adapters/hessian.js`
- Create: `agent/test/hessian.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `protocols/registry.mjs`（`hessian`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `hessian.js`、`fetch`
- Produces: 适配器 `hessian`；config `{ url, method, headers, timeoutMs }`；payload 为参数数组 JSON

- [ ] **Step 1: 写失败测试**

`agent/test/hessian.test.js`：起本地 HTTP mock，用 `hessian.js` 解码请求体（`[method, ...args]`），用 `hessian.js` 编码响应；适配器 `create({url, method:"echo", headers:{}})`，`send('{"encoding":"utf8","data":"[\\"hi\\"]"}')`；断言收到 `"hi"`。
另测非 2xx 响应 → `error` 含状态码。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 3: 实现适配器**

- `send`：解析 payload JSON 为参数数组；用 `hessian.js` 编码 `[config.method, ...args]`；`fetch(config.url, { method:"POST", headers: {"content-type":"x-application/hessian", ...}, body })`。
- 响应：按 `content-type` 判断；Hessian 响应解码为 `[type, value]` 或直接值；emit JSON。
- 30 秒超时（AbortController）；`close()` 中止。
- 协议约定写入文档：请求体是 Hessian2 数组 `[method, ...args]`；这只是调试用约定，不是通用 Hessian 服务发现。

- [ ] **Step 4: 注册表条目**

`hessian`：fields `url`、`method`、`headers`(keyvalue)；payload `json`。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent/adapters/hessian.js agent/test/hessian.test.js agent/adapters/index.js protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add hessian adapter"
```

---

### Task 5: AMQP 适配器

**Files:**
- Create: `agent/adapters/amqp.js`
- Create: `agent/test/amqp.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`
- Modify: `protocols/registry.mjs`（`amqp`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `amqplib`
- Produces: 适配器 `amqp`；config `{ url, operation:"publish"|"consume", exchange, routingKey, queue, headers, prefetch }`

- [ ] **Step 1: 安装依赖并写失败测试**

Run: `npm --prefix agent install amqplib`

`agent/test/amqp.test.js`：

- 单元：缺少 `url` 或未知 operation 时 `create` 抛错。
- 不可达：`create({ url:"amqp://127.0.0.1:1", operation:"publish", timeoutMs:500 })` 必须在 1 秒内 reject，错误含 `ECONNREFUSED`/`timeout`/`connect`。
- 集成（`AMQP_URL` 存在时）：连接、声明临时队列、publish、consume 收到同一条消息；`close()` 后连接关闭。无环境变量时 `test.skip`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 3: 实现适配器**

- `amqp.connect(url, { timeout: config.timeoutMs || 30000 })`；`createChannel()`；`assertQueue(queue, { durable:false, autoDelete:true })`（仅当 queue 非空）。
- `publish`：`channel.publish(exchange || "", routingKey || queue, body, { headers, contentType:"application/octet-stream" })`；`send` 一次发一条，然后保持连接。
- `consume`：`channel.prefetch(prefetch || 1)`；`consume(queue, msg => { emit data; channel.ack(msg) })`。
- broker 错误 → `emit error`，关闭 channel/connection；`close()` 幂等。
- 连接超时 30 秒。

- [ ] **Step 4: 注册表条目**

`amqp`：fields `url`、`operation`(select publish/consume)、`exchange`、`routingKey`、`queue`、`headers`(keyvalue)、`prefetch`(number)、`timeoutMs`(number, default 30000)；payload `binary`。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent`
Expected: 单元 PASS；集成在有 `AMQP_URL` 时 PASS，否则 SKIP

- [ ] **Step 6: Commit**

```bash
git add agent/adapters/amqp.js agent/test/amqp.test.js agent/adapters/index.js agent/package.json agent/package-lock.json protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add amqp adapter"
```

---

### Task 6: Kafka 适配器

**Files:**
- Create: `agent/adapters/kafka.js`
- Create: `agent/test/kafka.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`
- Modify: `protocols/registry.mjs`（`kafka`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `kafkajs`
- Produces: 适配器 `kafka`；config `{ brokers, topic, operation:"produce"|"consume", groupId, fromBeginning, key, headers }`

- [ ] **Step 1: 安装依赖并写失败测试**

Run: `npm --prefix agent install kafkajs`

`agent/test/kafka.test.js`：

- 单元：brokers 为空、operation 非法时抛错。
- 不可达：`create({ brokers:"127.0.0.1:1", topic:"t", operation:"produce", timeoutMs:500 })` 必须在 2 秒内 reject，错误含 `ECONNREFUSED`/`timeout`/`connect`。
- 集成（`KAFKA_BROKERS` 存在时）：produce 一条消息，consumer 从 `fromBeginning` 读到；断言 key/value/headers；`close()` 后 consumer 断开。无环境变量时 `test.skip`。
- 内存：连续 5000 条消息时，适配器保留的日志不超过 2000 条（测试内部计数器）。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 3: 实现适配器**

- `new Kafka({ clientId:"postwoman-agent", brokers: split(","), connectionTimeout: config.timeoutMs || 30000, retry: { retries: 0 } })`。
- `produce`：`producer.connect()`；`send({ topic, messages:[{ key, value, headers }] })`；保持连接。
- `consume`：`consumer({ groupId: groupId || "postwoman-"+random })`；`subscribe({ topic, fromBeginning })`；`run({ eachMessage: async ({message}) => emit data; })`。
- 每个消息 payload：`{ encoding:"base64", data, bytes, key?, headers?, topic, partition, offset }`。
- 断线不自动重连；错误 emit 后 `closed`。
- `close()`：`disconnect()`；幂等；30 秒连接超时。

- [ ] **Step 4: 注册表条目**

`kafka`：fields `brokers`、`topic`、`operation`(select produce/consume)、`groupId`、`fromBeginning`(checkbox)、`key`、`headers`(keyvalue)、`timeoutMs`(number, default 30000)；payload `binary`。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent`
Expected: 单元 PASS；集成在有 `KAFKA_BROKERS` 时 PASS，否则 SKIP

- [ ] **Step 6: Commit**

```bash
git add agent/adapters/kafka.js agent/test/kafka.test.js agent/adapters/index.js agent/package.json agent/package-lock.json protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add kafka adapter"
```

---

### Task 7: STOMP (TCP) 适配器

**Files:**
- Create: `agent/lib/stomp.js`
- Create: `agent/adapters/stomp-tcp.js`
- Create: `agent/test/stomp-tcp.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `protocols/registry.mjs`（`stomp-tcp`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `net`
- Produces:
  - `encodeFrame({ command, headers, body }) -> Buffer`
  - `FeedParser`（`push(buffer) -> frames[]`）
  - 适配器 `stomp-tcp`；config `{ host, port, login, passcode, connectHeaders, subscribeDestination, sendDestination }`

- [ ] **Step 1: 写帧编解码失败测试**

覆盖：CONNECT/CONNECTED、带 `content-length` 的二进制 body、无 content-length 的 null 结尾文本 body、心跳 `\n`。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 3: 实现帧编解码**

- 帧格式：`COMMAND\nheader:value\n...\n\nbody\0`。
- 含二进制 body 时必须写 `content-length`；parser 优先按长度读，否则读到 `\0`。
- 心跳是单独 `\n`，parser 忽略。
- 缓冲上限 16 MiB。

- [ ] **Step 4: 实现适配器与 mock 测试**

- `create`：TCP 连接；发送 CONNECT（`accept-version:1.2`、host、login/passcode、额外 headers）；收到 CONNECTED 后 resolve `ready`；若有订阅则发 SUBSCRIBE。
- `send`：发 SEND 到 `sendDestination`。
- 收到 MESSAGE：emit `data`（body 按 base64 或 utf8 标记）。
- 收到 ERROR：emit `error`；关闭连接。
- `close()`：发 DISCONNECT（尽力）+ 销毁 socket。
- mock 服务器：断言 CONNECT headers、回 CONNECTED、断言 SUBSCRIBE/SEND、发 MESSAGE；测试文本与二进制 body。

- [ ] **Step 5: 注册表条目**

`stomp-tcp`：fields `host`、`port`、`login`、`passcode`、`connectHeaders`(keyvalue)、`subscribeDestination`、`sendDestination`；payload `binary`。

- [ ] **Step 6: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add agent/lib/stomp.js agent/adapters/stomp-tcp.js agent/test/stomp-tcp.test.js agent/adapters/index.js protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add stomp tcp adapter"
```

---

### Task 8: 阶段 4 验收

**Files:**
- Modify: `docs/protocol-lab.md`
- Modify: `README.md`

- [ ] **Step 1: 文档**

写明各协议的连接参数、子集限制（gRPC 不支持 client/bidi streaming；Dubbo 是 2.x Hessian2；Thrift 只支持 TBinaryProtocol；Hessian 是调试约定；Kafka 不自动重连）、Docker 测试服务命令。

- [ ] **Step 2: 完整测试**

```bash
npm run test:unit
npm run test:agent
npm run generate
npx cypress run
```

Expected: 全部通过。

- [ ] **Step 3: 手工/集成验收**

1. gRPC：用 fixture server 或 `grpcurl` 测试服务，unary + server streaming。
2. Dubbo：对本地 mock 或 Java demo 发一次调用（无 demo 时记录 codec-only）。
3. Thrift：fixture server echo。
4. Hessian：本地 mock。
5. AMQP：`docker run -p 5672:5672 rabbitmq:3`，`AMQP_URL=amqp://localhost npm run test:agent`。
6. Kafka：`docker run -p 9092:9092 redpanda`，`KAFKA_BROKERS=127.0.0.1:9092 npm run test:agent`。
7. STOMP-TCP：本地 mock 或 RabbitMQ STOMP 插件（61613）。

- [ ] **Step 4: Commit**

```bash
git add docs/protocol-lab.md README.md
git commit -m "docs: document phase 4 rpc and messaging protocols"
```

## 阶段 4 完成标准

- 7 个条目可用；gRPC/Thrift/STOMP 有自动化往返测试。
- 需要 broker 的集成测试可通过环境变量启用。
- 断开后无残留连接、consumer、定时器。
- 构建与全部测试通过。
