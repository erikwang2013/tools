const ModbusRTU = require("modbus-serial")

const READ_ACTIONS = new Set([
  "readCoils",
  "readDiscreteInputs",
  "readHoldingRegisters",
  "readInputRegisters",
])
const COIL_ACTIONS = new Set(["readCoils", "readDiscreteInputs", "writeCoil"])
const WRITE_ACTIONS = new Set(["writeCoil", "writeRegister", "writeRegisters"])

function validate(config) {
  const unitId = Number(config.unitId)
  if (!Number.isInteger(unitId) || unitId < 1 || unitId > 247) throw new Error("unitId must be 1-247")
  const address = Number(config.address)
  if (!Number.isInteger(address) || address < 0 || address > 65535) {
    throw new Error("address must be 0-65535")
  }
  const action = config.action || "readHoldingRegisters"
  if (!READ_ACTIONS.has(action) && !WRITE_ACTIONS.has(action)) throw new Error("unsupported action")
  const quantity = Number(config.quantity === undefined ? 1 : config.quantity)
  const max = COIL_ACTIONS.has(action) ? 2000 : 125
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
    throw new Error(`quantity must be 1-${max}`)
  }
  if (WRITE_ACTIONS.has(action)) {
    const values = String(config.values || "")
      .split(",")
      .map(value => value.trim())
      .filter(value => value !== "")
      .map(Number)
    if (values.length !== quantity) throw new Error("values count must match quantity")
    if (action === "writeCoil" && values.some(value => value !== 0 && value !== 1)) {
      throw new Error("coil values must be 0 or 1")
    }
    if (action !== "writeCoil" && values.some(value => !Number.isInteger(value) || value < 0 || value > 65535)) {
      throw new Error("register values must be 0-65535")
    }
    return { unitId, address, action, quantity, values }
  }
  return { unitId, address, action, quantity, values: [] }
}

module.exports = {
  id: "modbus-tcp",
  create(config = {}, emit) {
    const port = Number(config.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return Promise.reject(new Error("invalid port"))
    }
    let options
    try {
      options = validate(config)
    } catch (error) {
      return Promise.reject(error)
    }
    const client = new ModbusRTU()
    let polling = false
    let inFlight = false
    let timer
    let closed = false

    const run = async () => {
      if (inFlight || closed) return
      inFlight = true
      try {
        let result
        if (options.action === "readCoils" || options.action === "readDiscreteInputs") {
          result = await client[options.action](options.address, options.quantity)
        } else if (options.action === "readHoldingRegisters" || options.action === "readInputRegisters") {
          result = await client[options.action](options.address, options.quantity)
        } else if (options.action === "writeCoil") {
          result = await client.writeCoil(options.address, options.values[0] === 1)
        } else if (options.action === "writeRegister") {
          result = await client.writeRegister(options.address, options.values[0])
        } else {
          result = await client.writeRegisters(options.address, options.values)
        }
        emit({
          type: "data",
          payload: {
            encoding: "utf8",
            data: JSON.stringify(
              result && result.data !== undefined
                ? { action: options.action, data: result.data }
                : { action: options.action, ok: true }
            ),
          },
        })
      } catch (error) {
        emit({ type: "error", payload: { message: error.message } })
      } finally {
        inFlight = false
        if (polling && !closed) timer = setTimeout(run, Number(config.intervalMs) || 1000)
      }
    }

    return client
      .connectTCP(config.host, { port })
      .then(() => {
        client.setID(options.unitId)
        return {
          ready: { unitId: options.unitId },
          send() {
            if (closed) throw new Error("connection closed")
            if (Number(config.intervalMs) > 0) {
              if (polling) {
                emit({ type: "log", payload: { level: "info", message: "poll already running" } })
                return
              }
              polling = true
              run()
              return
            }
            run()
          },
          close() {
            if (closed) return
            closed = true
            polling = false
            clearTimeout(timer)
            client.close(() => {})
          },
        }
      })
      .catch(error => {
        client.close(() => {})
        throw error
      })
  },
}
