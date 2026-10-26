const { performance } = require("node:perf_hooks")
const { Readable } = require("node:stream")
const { SessionManager } = require("../lib/session")
const { encode, decode } = require("../lib/envelope")
const { createHttpProxy } = require("../lib/http-proxy")
const { createHookRouter } = require("../lib/hooks")
const webhooks = require("../adapters/webhooks")
const { encodeIso8583, decodeIso8583 } = require("../lib/iso8583")
const { encodeChunk, RtmpChunkDecoder } = require("../lib/rtmp-chunk")
const { encodeApdu, FeedParser: IecParser, encodeAsdu } = require("../lib/iec104")
const { encodeFrame, FeedParser: StompParser } = require("../lib/stomp")
const { encodeAmf0, decodeAmf0 } = require("../lib/amf0")
const { buildRtpPacket, parseRtpPacket } = require("../lib/rtp")

const BUDGET_MS = 10

function percentile(samples, value) {
  const sorted = [...samples].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))]
}

function summarize(name, samples) {
  const cpu = samples.map(sample => sample.cpu)
  const wall = samples.map(sample => sample.wall)
  return {
    name,
    count: samples.length,
    cpuP50: percentile(cpu, 0.5),
    cpuP95: percentile(cpu, 0.95),
    cpuP99: percentile(cpu, 0.99),
    cpuMax: Math.max(...cpu),
    wallP50: percentile(wall, 0.5),
    wallP95: percentile(wall, 0.95),
    wallP99: percentile(wall, 0.99),
    wallMax: Math.max(...wall),
  }
}

function measure(name, fn, { iterations = 300, warmup = 20 } = {}) {
  for (let i = 0; i < warmup; i += 1) fn()
  const samples = []
  for (let i = 0; i < iterations; i += 1) {
    const cpuStart = process.cpuUsage()
    const start = performance.now()
    fn()
    const wall = performance.now() - start
    const cpu = process.cpuUsage(cpuStart)
    samples.push({ cpu: (cpu.user + cpu.system) / 1000, wall })
  }
  return summarize(name, samples)
}

async function measureAsync(name, fn, { iterations = 300, warmup = 20 } = {}) {
  for (let i = 0; i < warmup; i += 1) await fn()
  const samples = []
  for (let i = 0; i < iterations; i += 1) {
    const cpuStart = process.cpuUsage()
    const start = performance.now()
    await fn()
    const wall = performance.now() - start
    const cpu = process.cpuUsage(cpuStart)
    samples.push({ cpu: (cpu.user + cpu.system) / 1000, wall })
  }
  return summarize(name, samples)
}

function mockRequest({ body = "", headers = {}, url = "/proxy/http", method = "POST" } = {}) {
  const req = Readable.from(body ? [Buffer.from(body)] : [])
  req.method = method
  req.url = url
  req.headers = headers
  return req
}

function mockResponse() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    headersSent: false,
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers
      this.headersSent = true
    },
    end(chunk) {
      if (chunk) this.body += String(chunk)
    },
    on() {},
  }
}

async function run({ iterations = 300, warmup = 20 } = {}) {
  const results = []
  const message = { v: 1, type: "send", id: "bench", payload: { encoding: "utf8", data: "hello" } }
  const raw = encode(message)
  results.push(measure("envelope encode", () => encode(message), { iterations, warmup }))
  results.push(measure("envelope decode", () => decode(raw), { iterations, warmup }))

  const manager = new SessionManager({
    adapters: {
      echo: {
        create: () => Promise.resolve({ ready: {}, send() {}, close() {} }),
      },
    },
    emit: () => {},
  })
  let counter = 0
  results.push(
    await measureAsync(
      "session open",
      async () => {
        const id = `open-${counter++}`
        await manager.open(id, "echo", {})
        manager.close(id)
      },
      { iterations, warmup }
    )
  )
  await manager.open("keep", "echo", {})
  results.push(
    await measureAsync("session send", () => manager.send("keep", { encoding: "utf8", data: "hi" }), {
      iterations,
      warmup,
    })
  )

  const proxy = createHttpProxy({
    token: "t",
    origins: ["http://test"],
    allowNoOrigin: false,
    fetchImpl: async () =>
      new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
  })
  const proxyBody = JSON.stringify({ method: "GET", url: "http://upstream.test/", headers: {} })
  results.push(
    await measureAsync(
      "http proxy handler",
      () => proxy(mockRequest({ body: proxyBody, headers: { origin: "http://test", "x-agent-token": "t", "content-type": "application/json" } }), mockResponse()),
      { iterations, warmup }
    )
  )

  const hookRouter = createHookRouter()
  const hook = await webhooks.create(
    { responseCode: 200, responseBody: "ok" },
    () => {},
    { hookRouter, port: 3567 }
  )
  const secret = hook.ready.url.split("/").pop()
  results.push(
    await measureAsync(
      "webhook handler",
      () => hookRouter.handle(mockRequest({ body: "hi", url: `/hook/${secret}` }), mockResponse()),
      { iterations, warmup }
    )
  )

  const iso = {
    mti: "0200",
    fields: {
      2: "4111111111111111",
      3: "000000",
      4: "000000010000",
      7: "1024150000",
      11: "123456",
      41: "TERM0001",
      42: "MERCHANT0000001",
    },
  }
  const isoOptions = { lengthHeader: "2", lengthEncoding: "ascii" }
  const isoBuffer = encodeIso8583(iso, isoOptions)
  results.push(measure("iso8583 encode", () => encodeIso8583(iso, isoOptions), { iterations, warmup }))
  results.push(measure("iso8583 decode", () => decodeIso8583(isoBuffer, isoOptions), { iterations, warmup }))

  const rtmpFrame = encodeChunk({ typeId: 20, payload: Buffer.alloc(512, 0xab) })
  results.push(
    measure("rtmp chunk decode", () => new RtmpChunkDecoder().push(rtmpFrame), {
      iterations,
      warmup,
    })
  )

  const iecApdu = encodeApdu({
    type: "I",
    sendSeq: 1,
    recvSeq: 2,
    asdu: encodeAsdu({ typeId: 1, cause: 20, commonAddress: 1, ioa: 100, value: 1 }),
  })
  results.push(
    measure("iec104 decode", () => new IecParser().push(iecApdu), { iterations, warmup })
  )

  const stompFrame = encodeFrame({
    command: "MESSAGE",
    headers: { destination: "/q" },
    body: "hi",
  })
  results.push(
    measure("stomp decode", () => new StompParser().push(stompFrame), { iterations, warmup })
  )

  const amf = encodeAmf0({ app: "live", values: [1, true, "x"] })
  results.push(measure("amf0 decode", () => decodeAmf0(amf), { iterations, warmup }))

  const rtp = buildRtpPacket({ sequence: 1, timestamp: 0, ssrc: 42 }, Buffer.alloc(160))
  results.push(measure("rtp decode", () => parseRtpPacket(rtp), { iterations, warmup }))

  return results
}

function format(result) {
  return `${result.name.padEnd(20)} n=${String(result.count).padEnd(4)} cpu p99=${result.cpuP99.toFixed(
    3
  )}ms  wall p95=${result.wallP95.toFixed(3)}ms wall p99=${result.wallP99.toFixed(
    3
  )}ms max=${result.wallMax.toFixed(3)}ms`
}

async function main() {
  const results = await run()
  let failed = false
  for (const result of results) {
    console.log(format(result))
    if (result.cpuP99 >= BUDGET_MS) failed = true
  }
  console.log(
    `\nBudget: CPU processing p99 < ${BUDGET_MS}ms. Wall time is reported for visibility; ` +
      "external network and host scheduling are excluded."
  )
  if (failed) {
    console.error("FAIL: at least one local path exceeded the 10ms p99 budget.")
    process.exitCode = 1
  }
}

module.exports = { BUDGET_MS, run, format }

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
