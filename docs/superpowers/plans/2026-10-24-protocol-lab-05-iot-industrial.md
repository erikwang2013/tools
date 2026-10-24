# Protocol Lab 阶段 5：IoT 与工业协议实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 CoAP、LwM2M、OPC UA Binary、Modbus TCP、DNP3、IEC 60870-5-104、BACnet/IP 七个条目。

**Architecture:** 全部由 Agent 适配器实现。CoAP/LwM2M 共用 `coap`；OPC UA 用 `node-opcua`；Modbus 用 `modbus-serial`；DNP3/ IEC 104 / BACnet 用各自库或最小帧实现。测试优先用 mock peer；真实设备验证写入手工清单。

**Tech Stack:** Node 18、`coap`、`node-opcua`、`modbus-serial`、`dnp3`、自写 IEC 104/BACnet 帧子集、`node:test`。

**Spec:** `docs/superpowers/specs/2026-10-24-protocol-lab-design.md`
**共享契约:** `docs/superpowers/plans/2026-10-24-protocol-lab-index.md`
**前置:** 阶段 0–4 全部任务通过

## Global Constraints

- 沿用阶段 0–4 的全部约束。
- 每个协议只实现界面列出的动作；界面与文档必须写明子集。
- 地址/数量/单元 ID 在发送前校验，越界直接报错。
- 轮询/订阅必须有明确的停止路径；`close()` 后不得继续发请求。
- 真实硬件验证不在自动化范围内；README 提供手工清单。
- 需要模拟器的集成测试用环境变量启用（`DNP3_TARGET`、`IEC104_TARGET`、`BACNET_TARGET`）。

## Review Focus

1. Modbus 地址/数量越界或单元 ID 非法：发送前报错，不发到网络（Task 4）。
2. DNP3/IEC 104 收到非请求的主动上送帧：记录日志但不破坏请求/响应关联（Task 5、Task 6）。
3. OPC UA 安全策略/证书不匹配：错误可读，不断言崩溃（Task 3 的不可达测试 + 手工验收）。
4. CoAP Observe 取消：停止通知并释放定时器，不继续占用 socket（Task 1）。
5. Modbus 轮询超时：上一轮未完成时跳过下一轮，不堆积请求（Task 4）。

---

### Task 1: CoAP 适配器

**Files:**
- Create: `agent/adapters/coap.js`
- Create: `agent/test/coap.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`
- Modify: `protocols/registry.mjs`（`coap`）

**Interfaces:**
- Consumes: `coap`
- Produces: 适配器 `coap`；config `{ url, method, accept, contentType, observe }`；`ready: { observing }`

- [ ] **Step 1: 安装依赖并写失败测试**

Run: `npm --prefix agent install coap`

`agent/test/coap.test.js`：
- 起 `coap.createServer()` 监听随机 UDP 端口；对 GET/POST 返回 `2.05` 与回显 payload。
- 适配器 `create({url:"coap://127.0.0.1:<port>/x", method:"POST"}, emit)`；`send({encoding:"utf8",data:"hi"})`；断言收到 `2.05` 与 `hi`。
- Observe：server 每 50ms 推一条通知；适配器 open 后收到至少 2 条；`close()` 后不再收到（等待 150ms 断言）。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，未知协议 `coap`

- [ ] **Step 3: 实现适配器**

- `coap.request(config.url)`；设置 `req.method`（默认 GET）、`req.setOption("Accept", ...)`、`Content-Format`；有 payload 时 `req.write(bytes)`。
- `observe` 为 true 时设置 `req.setOption("Observe", 0)`，保持请求不结束；每次 `response` 事件把 payload emit 为 data。
- 非 Observe：一次 response 后 `closed`。
- 响应码 >= 4.00 时 emit `error` 并附 code。
- 30 秒超时；`close()` 取消 observe 并关闭 socket。
- 只支持 `coap://`，不支持 DTLS。

- [ ] **Step 4: 注册表条目**

`coap`：fields `url`、`method`(select GET/POST/PUT/DELETE)、`accept`、`contentType`、`observe`(checkbox)；payload `binary`。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent/adapters/coap.js agent/test/coap.test.js agent/adapters/index.js agent/package.json agent/package-lock.json protocols/registry.mjs
git commit -m "feat(agent): add coap adapter"
```

---

### Task 2: LwM2M 适配器

**Files:**
- Create: `agent/lib/lwm2m.js`
- Create: `agent/adapters/lwm2m.js`
- Create: `agent/test/lwm2m.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `protocols/registry.mjs`（`lwm2m`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `coap`
- Produces:
  - `buildRegisterPayload({ endpoint, objects }) -> { query, body }`
  - `buildObjectPath(path) -> string`
  - 适配器 `lwm2m`；config `{ serverUrl, endpointName, action:"register"|"read"|"write"|"observe", objectPath, value, lifetime }`；`ready: { location? }`

- [ ] **Step 1: 写失败测试**

`agent/test/lwm2m.test.js`：
- 单元：`buildRegisterPayload({endpoint:"dev1", objects:["/3/0","/4/0"], lifetime:300})` 返回 `query` 含 `ep=dev1&lt=300`，body 含 `</3/0>;rt="oma.lwm2m"`。
- 集成：起 mock CoAP server；register 返回 `2.01` + `Location-Path: rd/abc`；适配器断言 `ready.location === "rd/abc"`；read 发到 `/rd/abc/3/0/1` 并返回 `2.05` + `25.5`；observe 收到两条通知，close 后停止。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 3: 实现**

- Register：`POST coap://host/rd?ep=<name>&lt=<lifetime>`，payload 为 Link format（`</3/0>;rt="oma.lwm2m"`），`Content-Format: 40`（link-format）。
- 保存 `Location-Path` 选项（多段用 `/` 拼接）。
- Read：`GET <server>/<location>/<objectPath>`，`Accept: text/plain`（0）。
- Write：`PUT <server>/<location>/<objectPath>`，payload 文本，`Content-Format: 0`。
- Observe：`GET ...` + `Observe: 0`；close 时取消。
- 只支持文本格式与单实例路径；TLV 编解码不在本阶段（文档写明）。
- `close()` 取消 observe 并释放。

- [ ] **Step 4: 注册表条目**

`lwm2m`：fields `serverUrl`、`endpointName`、`action`(select register/read/write/observe)、`objectPath`(default `/3/0/1`)、`value`、`lifetime`(number, default 300)；payload `text`。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent/lib/lwm2m.js agent/adapters/lwm2m.js agent/test/lwm2m.test.js agent/adapters/index.js protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add lwm2m adapter"
```

---

### Task 3: OPC UA Binary 适配器

**Files:**
- Create: `agent/adapters/opcua.js`
- Create: `agent/test/opcua.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`
- Modify: `protocols/registry.mjs`（`opcua`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `node-opcua`
- Produces: 适配器 `opcua`；config `{ endpointUrl, username, password, action:"browse"|"read"|"write", nodeId, value }`

- [ ] **Step 1: 安装依赖并写失败测试**

Run: `npm --prefix agent install node-opcua`

`agent/test/opcua.test.js`：
- 起 `OPCUAServer`（端口随机，security none），添加变量 `ns=1;s=Demo` 初始值 `42`。
- 适配器 `create({endpointUrl:"opc.tcp://127.0.0.1:<port>", action:"read", nodeId:"ns=1;s=Demo"}, emit)`；断言读到 `42`。
- write 后 read 断言新值。
- 错误 endpoint：错误信息包含 `connect` 或 `ECONNREFUSED`，不挂起。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL，未知协议 `opcua`

- [ ] **Step 3: 实现适配器**

- `OPCUAClient.create({ endpointMustExist:false, securityMode:"None", securityPolicy:"None" })`；`connect(endpointUrl)`；`createSession(username/password 或匿名)`。
- `browse`：`session.browse(nodeId)`，emit 引用摘要。
- `read`：`session.readVariableValue(nodeId)`，emit `{statusCode, value}`。
- `write`：`session.write({nodeId, attributeId: AttributeIds.Value, value:{value:{dataType:..., value}}})`；类型按 JSON 推断（number/string/boolean）。
- 证书/安全错误 emit `error`，关闭 session；30 秒连接超时；`close()` disconnect。
- 只支持 SecurityPolicy None 与用户名/密码；证书管理与订阅不在范围。`node-opcua` 安装体积大，文档注明。

- [ ] **Step 4: 注册表条目**

`opcua`：fields `endpointUrl`、`username`、`password`、`action`(select browse/read/write)、`nodeId`、`value`；payload `text`。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS（node-opcua 测试可能较慢；超时设为 30 秒）

- [ ] **Step 6: Commit**

```bash
git add agent/adapters/opcua.js agent/test/opcua.test.js agent/adapters/index.js agent/package.json agent/package-lock.json protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add opc ua adapter"
```

---

### Task 4: Modbus TCP 适配器

**Files:**
- Create: `agent/adapters/modbus.js`
- Create: `agent/test/modbus.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`
- Modify: `protocols/registry.mjs`（`modbus-tcp`）

**Interfaces:**
- Consumes: `modbus-serial`；devDependency `jsmodbus`
- Produces: 适配器 `modbus-tcp`；config `{ host, port, unitId, action, address, quantity, values, intervalMs }`；`ready: { unitId }`

- [ ] **Step 1: 安装依赖并写失败测试**

Run: `npm --prefix agent install modbus-serial && npm --prefix agent install --save-dev jsmodbus`

`agent/test/modbus.test.js`：
- 用 `jsmodbus` 起 TCP server，保持 holding registers `[1,2,3,4]`。
- 适配器 readHoldingRegisters address 0 quantity 4 → 断言 `[1,2,3,4]`。
- writeRegister address 0 value 9 → read 断言 9。
- 越界：address 70000、quantity 0、unitId 300 → `create`/`send` 前抛错，服务器未收到请求。
- 轮询：`intervalMs:50`，server 延迟 200ms 响应；断言同时只有一个未完成请求（server 计数并发 <= 1）。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 3: 实现适配器**

- `new ModbusRTU()` 的 TCP 模式：`client.connectTCP(host, { port })`；`setID(unitId)`。
- 校验：`unitId` 1–247；`address` 0–65535；`quantity` 1–125（寄存器）/1–2000（线圈）；`values` 数量与 quantity 一致。
- 动作映射：`readCoils`、`readDiscreteInputs`、`readHoldingRegisters`、`readInputRegisters`、`writeCoil`、`writeRegister`、`writeRegisters`。
- 轮询：`intervalMs > 0` 时用递归 `setTimeout`，上一轮完成才排下一轮；`close()` 清除 timer。
- 结果 emit 文本 JSON（地址→值）。
- 30 秒超时；`close()` 关闭 client；幂等。

- [ ] **Step 4: 注册表条目**

`modbus-tcp`：fields `host`、`port`(502)、`unitId`(1)、`action`(select 上述动作)、`address`(0)、`quantity`(1)、`values`(text, 逗号分隔)、`intervalMs`(number, 0)；payload `none`。

- [ ] **Step 5: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add agent/adapters/modbus.js agent/test/modbus.test.js agent/adapters/index.js agent/package.json agent/package-lock.json protocols/registry.mjs
git commit -m "feat(agent): add modbus tcp adapter"
```

---

### Task 5: DNP3 适配器

**Files:**
- Create: `agent/adapters/dnp3.js`
- Create: `agent/test/dnp3.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`
- Modify: `protocols/registry.mjs`（`dnp3`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `dnp3` 包（先 spike 验证 API）
- Produces: 适配器 `dnp3`；config `{ host, port, masterAddress, outstationAddress, action, index, value }`

- [ ] **Step 1: 先做库 spike**

Run:

```bash
npm view dnp3 version description
npm --prefix agent install dnp3
node -e "const d=require('dnp3'); console.log(Object.keys(d))"
```

记录可用的 master/outstation API。若包不可用，改为最小链路层 + 应用层子集实现（链路头、CRC、READ 请求），并在文档写明。

- [ ] **Step 2: 写测试**

`agent/test/dnp3.test.js`：
- 单元：config 校验（master/outstation 0–65519，index 0–65535）。
- 集成（`DNP3_TARGET=host:port` 存在时）：连接模拟器，执行 integrity poll / class 0 read，断言收到数据；无环境变量时 `test.skip`。
- 主动上送：mock/模拟器发送非请求帧（若库支持），断言日志出现但不影响后续请求。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL 或 SKIP

- [ ] **Step 4: 实现适配器**

- 连接：`master.connect()`（或等价 API）；`ready: { masterAddress, outstationAddress }`。
- 动作：`integrityPoll`、`readClass0/1/2/3`、`operate`（选择 `index`、`value`，仅支持 CROB 子集）。
- 响应：emit 文本 JSON（点号、值、质量位）。
- 主动上送：单独日志，不参与请求关联。
- 30 秒超时；`close()` 断开；不自动重连。
- 子集：不支持文件传输、冷/热重启、时间同步。

- [ ] **Step 5: 注册表条目**

`dnp3`：fields `host`、`port`(20000)、`masterAddress`(1)、`outstationAddress`(10)、`action`(select)、`index`、`value`；payload `none`。

- [ ] **Step 6: 运行测试**

Run: `npm run test:agent`
Expected: 单元 PASS；集成有环境变量时 PASS，否则 SKIP

- [ ] **Step 7: Commit**

```bash
git add agent/adapters/dnp3.js agent/test/dnp3.test.js agent/adapters/index.js agent/package.json agent/package-lock.json protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add dnp3 adapter"
```

---

### Task 6: IEC 60870-5-104 适配器

**Files:**
- Create: `agent/lib/iec104.js`
- Create: `agent/adapters/iec104.js`
- Create: `agent/test/iec104.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `protocols/registry.mjs`（`iec104`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `net`、自写 APCI/ASDU 子集
- Produces:
  - `encodeApdu({ type:"I"|"S"|"U", sendSeq?, recvSeq?, asdu? }) -> Buffer`
  - `FeedParser`（`push(buffer) -> apdus[]`）
  - `encodeInterrogation({ commonAddress })`、`encodeRead({ commonAddress, ioa })`
  - 适配器 `iec104`；config `{ host, port, commonAddress, action:"startdt"|"interrogation"|"read", ioa }`

- [ ] **Step 1: 写编解码失败测试**

- APCI 起始 `0x68`、长度、控制域；I-frame 的发送/接收序号正确。
- U-frame STARTDT act/confirm；S-frame。
- ASDU：类型 ID、VSQ、COT、公共地址、IOA；总召唤 `C_IC_NA_1`（100）、读 `C_RD_NA_1`（102）。
- 解析一个 `M_ME_NA_1`（9）或 `M_SP_NA_1`（1）数据帧，断言 IOA 与值。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL

- [ ] **Step 3: 实现编解码**

- APDU：`0x68` + 长度（4–253）+ 4 字节控制域 + ASDU。
- I-frame 控制域：bit0=0，发送序号 15 位（左移 1），接收序号 15 位（左移 1）。
- U-frame：STARTDT act `0x07`、STARTDT con `0x0b`、TESTFR、STOPDT。
- ASDU：type id、VSQ（SQ=0，数量=1）、COT（act=6/con=7/actcon=10）、originator、common address（2 字节）、IOA（3 字节）。
- 解析：按长度拆帧；只解析上述类型；未知类型记为 hex 日志。

- [ ] **Step 4: 实现适配器与 mock 测试**

- `create`：`net.connect`；发送 STARTDT act；收到 STARTDT con 后 `ready`。
- `send`：按 action 发总召唤或读命令；解析 I-frame 并 emit JSON（IOA/type/value）。
- 主动上送（COT=3）单独日志，不参与请求关联。
- 保持发送/接收序号；S-frame 确认收到的帧。
- `close()` 发送 STOPDT（尽力）并销毁 socket；30 秒超时。
- mock 服务器：解析 STARTDT，回 con；收到总召唤后回 `M_SP_NA_1` 数据帧；断言适配器输出。

- [ ] **Step 5: 注册表条目**

`iec104`：fields `host`、`port`(2404)、`commonAddress`(1)、`action`(select startdt/interrogation/read)、`ioa`(number)；payload `none`。

- [ ] **Step 6: 运行测试**

Run: `npm run test:agent && npm run test:unit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add agent/lib/iec104.js agent/adapters/iec104.js agent/test/iec104.test.js agent/adapters/index.js protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add iec 60870-5-104 adapter"
```

---

### Task 7: BACnet/IP 适配器

**Files:**
- Create: `agent/adapters/bacnet.js`
- Create: `agent/test/bacnet.test.js`
- Modify: `agent/adapters/index.js`
- Modify: `agent/package.json`
- Modify: `protocols/registry.mjs`（`bacnet-ip`）
- Modify: `docs/protocol-lab.md`

**Interfaces:**
- Consumes: `@bacnet-js/client`（先 spike 验证）或 `bacstack`
- Produces: 适配器 `bacnet-ip`；config `{ target, deviceId, action:"whoIs"|"readProperty"|"writeProperty", objectType, instance, property, value }`

- [ ] **Step 1: 先做库 spike**

Run:

```bash
npm view @bacnet-js/client version description
npm view bacstack version description
npm --prefix agent install @bacnet-js/client
node -e "const b=require('@bacnet-js/client'); console.log(Object.keys(b))"
```

记录可用 API；不可用则改用 `bacstack`。若两者都不可用，最小实现 Who-Is/I-Am 与 ReadProperty-ACK 子集，并在文档写明。

- [ ] **Step 2: 写测试**

`agent/test/bacnet.test.js`：
- 单元：objectType/instance/property 必填校验；deviceId 0–4194303。
- 集成（`BACNET_TARGET=host` 存在时）：whoIs 在超时内返回设备；readProperty 返回值；无环境变量时 `test.skip`。
- 错误：目标不可达时在 5 秒内报错并关闭 socket，不无限等待。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm run test:agent`
Expected: FAIL 或 SKIP

- [ ] **Step 4: 实现适配器**

- 绑定本地随机端口（UDP 47808 常被占用）；`whoIs` 广播/单播到 target:47808，收集 I-Am。
- `readProperty`：构造 ReadProperty 请求，解析 ACK 的 object id/property/value；emit 文本 JSON。
- `writeProperty`：仅支持数字/布尔/字符串的 present-value 子集。
- 5 秒响应超时；`close()` 关闭 socket；不实现 COV/订阅/BBMD。
- 文档写明只支持 BACnet/IP（UDP），不支持 BACnet MS/TP。

- [ ] **Step 5: 注册表条目**

`bacnet-ip`：fields `target`、`deviceId`、`action`(select whoIs/readProperty/writeProperty)、`objectType`、`instance`、`property`、`value`；payload `none`。

- [ ] **Step 6: 运行测试**

Run: `npm run test:agent`
Expected: 单元 PASS；集成有环境变量时 PASS，否则 SKIP

- [ ] **Step 7: Commit**

```bash
git add agent/adapters/bacnet.js agent/test/bacnet.test.js agent/adapters/index.js agent/package.json agent/package-lock.json protocols/registry.mjs docs/protocol-lab.md
git commit -m "feat(agent): add bacnet/ip adapter"
```

---

### Task 8: 阶段 5 验收

**Files:**
- Modify: `docs/protocol-lab.md`
- Modify: `README.md`

- [ ] **Step 1: 文档**

写明每个协议的地址/点表参数、子集、模拟器命令、真实设备手工验证清单、安全提示（这些协议通常无认证，只在隔离网络使用）。

- [ ] **Step 2: 完整测试**

```bash
npm run test:unit
npm run test:agent
npm run generate
npx cypress run
```

Expected: 全部通过。

- [ ] **Step 3: 手工/模拟器验收**

1. CoAP：`coap` 自带 server 或 `coap-cli`；GET/POST/Observe。
2. LwM2M：mock server 或 Leshan demo；register/read/observe。
3. OPC UA：本地 OPC UA server（node-opcua 示例）；read/write。
4. Modbus：`jsmodbus` server；读写寄存器/线圈与轮询。
5. DNP3：`DNP3_TARGET` 指向模拟器；integrity poll。
6. IEC 104：`IEC104_TARGET` 指向模拟器；STARTDT + 总召唤。
7. BACnet：`BACNET_TARGET` 指向 `bacnet-stack` 模拟器；whoIs/readProperty。

- [ ] **Step 4: Commit**

```bash
git add docs/protocol-lab.md README.md
git commit -m "docs: document phase 5 iot and industrial protocols"
```

## 阶段 5 完成标准

- 7 个条目可用；地址/数量校验在发送前生效。
- 轮询/订阅在断开后停止。
- 模拟器验收通过；真实设备验证步骤写入文档。
- 构建与全部测试通过。
