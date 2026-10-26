const test = require("node:test")
const assert = require("node:assert/strict")
const { spawn } = require("node:child_process")
const fs = require("node:fs")
const net = require("node:net")
const os = require("node:os")
const path = require("node:path")

const CLI = path.join(__dirname, "..", "index.js")
const DEFAULT_CONFIG = path.join(__dirname, "..", "config.json")

// Spawns pass an explicit empty config so a developer's agent/config.json cannot leak in.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "postwoman-cli-"))
const EMPTY_CONFIG = path.join(TMP, "empty-config.json")
fs.writeFileSync(EMPTY_CONFIG, "{}")
test.after(() => fs.rmSync(TMP, { recursive: true, force: true }))

function runCli(args) {
  const child = spawn(process.execPath, [CLI, ...args], { stdio: ["ignore", "pipe", "pipe"] })
  const out = { stdout: "", stderr: "" }
  child.stdout.on("data", chunk => { out.stdout += chunk })
  child.stderr.on("data", chunk => { out.stderr += chunk })
  const exited = new Promise(resolve => child.on("exit", (code, signal) => resolve({ code, signal })))
  return { child, out, exited }
}

function waitForOutput(run, stream, pattern, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const tick = () => {
      if (pattern.test(run.out[stream])) return resolve()
      if (Date.now() > deadline) {
        return reject(new Error(`timed out waiting for ${pattern} in ${stream}; got: ${run.out[stream]}`))
      }
      setTimeout(tick, 20)
    }
    tick()
  })
}

function exitWithin(run, timeoutMs = 10000) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("CLI did not exit in time")), timeoutMs)
  })
  return Promise.race([run.exited, timeout]).finally(() => clearTimeout(timer))
}

test("prints the listening URL and token, then exits 0 on SIGTERM", async () => {
  const run = runCli([
    "--port", "0", "--token", "test-token", "--origin", "http://localhost:3000",
    "--config", EMPTY_CONFIG,
  ])
  try {
    await waitForOutput(run, "stdout", /Token: test-token/)
    assert.match(run.out.stdout, /ws:\/\/127\.0\.0\.1:\d+\/agent/)
    run.child.kill("SIGTERM")
    const { code } = await exitWithin(run)
    assert.equal(code, 0)
  } finally {
    run.child.kill("SIGKILL")
  }
})

test("reports an occupied port on stderr and exits non-zero", async () => {
  const blocker = net.createServer()
  await new Promise((resolve, reject) => {
    blocker.once("error", reject)
    blocker.listen(0, "127.0.0.1", resolve)
  })
  const run = runCli(["--port", String(blocker.address().port), "--token", "test-token", "--config", EMPTY_CONFIG])
  try {
    const { code } = await exitWithin(run)
    assert.notEqual(code, 0)
    assert.match(run.out.stderr, /already in use/)
  } finally {
    run.child.kill("SIGKILL")
    await new Promise(resolve => blocker.close(resolve))
  }
})

test("rejects a host other than 127.0.0.1", async () => {
  const run = runCli(["--port", "0", "--host", "0.0.0.0", "--config", EMPTY_CONFIG])
  try {
    const { code } = await exitWithin(run)
    assert.equal(code, 1)
    assert.match(run.out.stderr, /127\.0\.0\.1/)
  } finally {
    run.child.kill("SIGKILL")
  }
})

test("rejects an empty token", async () => {
  const run = runCli(["--port", "0", "--token", "", "--config", EMPTY_CONFIG])
  try {
    const { code } = await exitWithin(run)
    assert.equal(code, 1)
    assert.match(run.out.stderr, /token/i)
  } finally {
    run.child.kill("SIGKILL")
  }
})

test("exits 1 when an explicit config file cannot be read", async () => {
  const run = runCli(["--port", "0", "--config", path.join(__dirname, "missing-config.json")])
  try {
    const { code } = await exitWithin(run)
    assert.equal(code, 1)
    assert.match(run.out.stderr, /config/i)
  } finally {
    run.child.kill("SIGKILL")
  }
})

test("--origin adds to the default allowlist", async () => {
  const run = runCli([
    "--port", "0", "--token", "test-token", "--origin", "http://extra.test",
    "--config", EMPTY_CONFIG,
  ])
  try {
    await waitForOutput(run, "stdout", /http:\/\/extra\.test/)
    assert.match(run.out.stdout, /Allowed origins: .*https:\/\/tools\.erik\.xyz.*http:\/\/extra\.test/)
  } finally {
    run.child.kill("SIGKILL")
  }
})

test("loads agent/config.json by default and fails on invalid JSON", async t => {
  if (fs.existsSync(DEFAULT_CONFIG)) {
    t.skip("agent/config.json already exists; not overwriting a developer config")
    return
  }
  let run
  try {
    fs.writeFileSync(DEFAULT_CONFIG, "{ not json")
    run = runCli(["--port", "0"])
    const { code } = await exitWithin(run)
    assert.equal(code, 1)
    assert.match(run.out.stderr, /config\.json/)
  } finally {
    if (run) run.child.kill("SIGKILL")
    fs.rmSync(DEFAULT_CONFIG, { force: true })
  }
})
