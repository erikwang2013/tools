const { spawn } = require("node:child_process")

module.exports = {
  id: "mcp-stdio",
  create(config = {}, emit, context = {}) {
    const servers = context.mcpServers || {}
    const server = config.server
    if (typeof server !== "string" || server === "") {
      return Promise.reject(new Error("server is required"))
    }
    const definition = servers[server]
    if (!definition || typeof definition.command !== "string") {
      return Promise.reject(new Error(`unknown MCP server: ${server}`))
    }

    let child
    try {
      child = spawn(definition.command, definition.args || [], {
        env: { ...process.env, ...(definition.env || {}) },
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      })
    } catch (error) {
      return Promise.reject(error)
    }

    const state = { closed: false, buffer: "" }
    const finish = reason => {
      if (state.closed) return
      state.closed = true
      emit({ type: "closed", payload: { reason } })
    }

    child.stdout.setEncoding("utf8")
    child.stdout.on("data", chunk => {
      state.buffer += chunk
      let index
      while ((index = state.buffer.indexOf("\n")) !== -1) {
        const line = state.buffer.slice(0, index).trim()
        state.buffer = state.buffer.slice(index + 1)
        if (!line) continue
        try {
          JSON.parse(line)
        } catch {
          emit({ type: "log", payload: { level: "warn", message: `unparsed stdout: ${line}` } })
          continue
        }
        emit({ type: "data", payload: { encoding: "utf8", data: line, bytes: Buffer.byteLength(line) } })
      }
    })

    child.stderr.setEncoding("utf8")
    child.stderr.on("data", chunk => {
      emit({ type: "log", payload: { level: "warn", message: chunk.toString() } })
    })

    child.on("error", error => {
      emit({ type: "error", payload: { message: error.message } })
      finish(error.message)
    })
    child.on("exit", code => finish(`process exited with code ${code}`))

    return new Promise((resolve, reject) => {
      child.once("spawn", () => {
        resolve({
          ready: { name: server },
          send(payload) {
            if (state.closed) throw new Error("process is not running")
            const text = payload && payload.encoding === "utf8" ? payload.data : null
            let message
            try {
              message = JSON.parse(text)
            } catch {
              throw new Error("MCP stdio payload must be JSON")
            }
            if (message === null || typeof message !== "object") {
              throw new Error("MCP stdio payload must be a JSON object")
            }
            child.stdin.write(`${JSON.stringify(message)}\n`)
          },
          close() {
            if (state.closed) return
            child.kill("SIGTERM")
            setTimeout(() => {
              if (!state.closed) child.kill("SIGKILL")
            }, 2000).unref()
          },
        })
      })
      child.once("error", error => {
        if (!state.closed) reject(error)
      })
    })
  },
}
