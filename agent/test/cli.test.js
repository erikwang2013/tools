const test = require("node:test")
const assert = require("node:assert/strict")
const { spawn } = require("node:child_process")
const net = require("node:net")
const path = require("node:path")

const CLI = path.join(__dirname, "..", "index.js")

function runCli(args) {
  const child = spawn(process.execPath, [CLI, ...args], { stdio: ["ignore", "pipe", "pipe"] })
  const out = { stdout: "", stderr: "" }
  child.stdout.on("data", chunk => { out.stdout += chunk })
  child.stderr.on("data", chunk => { out.stderr += chunk })
  const exited = new Promise(resolve => child.on("exit", (code, signal) => resolve({ code, signal })))
  return { child, out, exited }
}

function waitForOutput(run, stream, pattern, timeoutMs = 5000) {
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

function exitWithin(run, timeoutMs = 5000) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("CLI did not exit in time")), timeoutMs)
  })
  return Promise.race([run.exited, timeout]).finally(() => clearTimeout(timer))
}

test("prints the listening URL and token, then exits 0 on SIGTERM", async () => {
  const run = runCli(["--port", "0", "--token", "test-token", "--origin", "http://localhost:3000"])
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
  const run = runCli(["--port", String(blocker.address().port), "--token", "test-token"])
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
  const run = runCli(["--port", "0", "--host", "0.0.0.0"])
  try {
    const { code } = await exitWithin(run)
    assert.equal(code, 1)
    assert.match(run.out.stderr, /127\.0\.0\.1/)
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
