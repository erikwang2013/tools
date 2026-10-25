const MAX_REQUEST_BYTES = 16 * 1024 * 1024

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on("data", chunk => {
      total += chunk.length
      if (total > MAX_REQUEST_BYTES) {
        reject(Object.assign(new Error("request body too large"), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => resolve(Buffer.concat(chunks, total)))
    req.on("error", reject)
  })
}

function createHookRouter() {
  const handlers = new Map()

  function register(secret, handler) {
    handlers.set(secret, handler)
  }

  function unregister(secret) {
    handlers.delete(secret)
  }

  async function handle(req, res) {
    const match = /^\/hook\/([A-Za-z0-9]+)(?:[/?].*)?$/.exec(req.url || "")
    if (!match) return false
    const handler = handlers.get(match[1])
    if (!handler) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: "unknown hook" }))
      return true
    }
    try {
      const body = await readBody(req)
      await handler({ req, res, body })
    } catch (error) {
      if (!res.headersSent) res.writeHead(error.status || 500, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ error: error.message }))
    }
    return true
  }

  return { register, unregister, handle }
}

module.exports = { createHookRouter, MAX_REQUEST_BYTES }
