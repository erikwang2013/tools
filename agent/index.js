const fs = require("node:fs")
const path = require("node:path")
const { createAgentServer } = require("./lib/server")
const { DEFAULT_ORIGINS } = require("./lib/origin")
const adapters = require("./adapters")

class CliError extends Error {}

function fail(message) {
  throw new CliError(message)
}

function parseArgs(argv) {
  const args = { port: 3567, host: "127.0.0.1", origins: [], token: undefined, configPath: undefined }
  const flags = ["--port", "--host", "--origin", "--token", "--config"]
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (!flags.includes(flag)) fail(`Unknown argument: ${flag}`)
    if (value === undefined) fail(`Missing value for ${flag}`)
    i += 1
    if (flag === "--port") args.port = Number(value)
    else if (flag === "--host") args.host = value
    else if (flag === "--origin") args.origins.push(value)
    else if (flag === "--token") {
      if (value.trim() === "") fail("--token must not be empty.")
      args.token = value
    } else args.configPath = value
  }
  return args
}

function loadConfig(file) {
  let raw
  try {
    raw = fs.readFileSync(file, "utf8")
  } catch (err) {
    fail(`Cannot read config file ${file}: ${err.message}`)
  }
  let config
  try {
    config = JSON.parse(raw)
  } catch (err) {
    fail(`Invalid JSON in config file ${file}: ${err.message}`)
  }
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    fail(`Config file ${file} must contain a JSON object.`)
  }
  return config
}

function loadDefaultConfig() {
  const file = path.join(__dirname, "config.json")
  return fs.existsSync(file) ? loadConfig(file) : {}
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.host !== "127.0.0.1") fail("--host only supports 127.0.0.1; the agent must stay on the local machine.")

  const config = args.configPath !== undefined ? loadConfig(args.configPath) : loadDefaultConfig()
  const origins = [...new Set([...DEFAULT_ORIGINS, ...args.origins])]

  let agent
  try {
    agent = await createAgentServer({
      port: args.port,
      host: args.host,
      token: args.token,
      origins,
      adapters,
      config,
    })
  } catch (err) {
    if (err.code === "EADDRINUSE") fail(`Port ${args.port} is already in use. Start with --port <other>.`)
    fail(`Failed to start the agent: ${err.message}`)
  }

  console.log(`Postwoman Agent listening on ws://127.0.0.1:${agent.port}/agent`)
  console.log(`Token: ${agent.token}`)
  console.log(`Allowed origins: ${origins.join(", ")}`)
  console.log("Press Ctrl+C to stop.")

  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    try {
      await agent.close()
    } finally {
      process.exit(0)
    }
  }
  process.on("SIGINT", stop)
  process.on("SIGTERM", stop)
}

main().catch(err => {
  console.error(err instanceof CliError ? err.message : `Agent failed: ${err.message}`)
  process.exitCode = 1
})
