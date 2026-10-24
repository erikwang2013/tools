async function closeQuietly(adapter) {
  try {
    await adapter.close()
  } catch {}
}

class SessionManager {
  constructor({ adapters = {}, emit = () => {}, maxSessions = 32, openTimeoutMs = 30000, context = {} } = {}) {
    this.adapters = adapters
    this.emit = emit
    this.maxSessions = maxSessions
    this.openTimeoutMs = openTimeoutMs
    this.context = context
    this.sessions = new Map()
  }

  async open(id, protocol, config) {
    const impl = this.adapters[protocol]
    if (!impl) this.fail(id, null, `unknown protocol: ${protocol}`)
    if (this.sessions.has(id)) this.fail(id, null, `session already open: ${id}`)
    if (this.sessions.size >= this.maxSessions) this.fail(id, null, "too many sessions")

    // Reserve the id before awaiting so concurrent opens cannot exceed maxSessions.
    const record = { adapter: null, adapterClosed: false, done: false }
    this.sessions.set(id, record)
    const pending = Promise.resolve().then(() =>
      impl.create(config, event => this.forward(id, record, event), this.context)
    )
    pending.catch(() => {})

    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`session open timed out: ${id}`)), this.openTimeoutMs)
    })
    try {
      const adapter = await Promise.race([pending, timeout])
      clearTimeout(timer)
      if (record.done) {
        await closeQuietly(adapter)
        throw new Error(`session closed before it opened: ${id}`)
      }
      record.adapter = adapter
      return { ready: adapter.ready || {} }
    } catch (err) {
      clearTimeout(timer)
      // A create that resolves after a timeout or a close during open must not leak.
      // close() is expected to be idempotent, so this may repeat an earlier close.
      pending.then(adapter => closeQuietly(adapter)).catch(() => {})
      if (!record.done) {
        record.done = true
        this.release(id, record)
        this.emit(id, { type: "error", payload: { message: err.message } })
        this.emit(id, { type: "closed", payload: {} })
      }
      throw err
    }
  }

  async send(id, payload) {
    const record = this.sessions.get(id)
    if (!record || !record.adapter) throw new Error(`unknown session: ${id}`)
    await record.adapter.send(payload)
  }

  close(id) {
    const record = this.sessions.get(id)
    if (!record) return false
    record.done = true
    this.release(id, record)
    if (record.adapter) closeQuietly(record.adapter)
    if (!record.adapterClosed) this.emit(id, { type: "closed", payload: {} })
    return true
  }

  closeAll() {
    for (const id of [...this.sessions.keys()]) this.close(id)
  }

  forward(id, record, event) {
    if (record.done) return
    if (event.type === "closed") {
      // The adapter died on its own: free the id and capacity, keep its single closed frame.
      record.adapterClosed = true
      record.done = true
      this.release(id, record)
    }
    this.emit(id, event)
  }

  release(id, record) {
    if (this.sessions.get(id) === record) this.sessions.delete(id)
  }

  fail(id, record, message) {
    if (record) {
      record.done = true
      this.release(id, record)
    }
    this.emit(id, { type: "error", payload: { message } })
    this.emit(id, { type: "closed", payload: {} })
    throw new Error(message)
  }
}

module.exports = { SessionManager }
