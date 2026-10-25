const test = require("node:test")
const assert = require("node:assert/strict")
const net = require("node:net")
const adapter = require("../adapters/modbus")

function modbusServer(registers) {
  return net.createServer(socket => {
    let buffer = Buffer.alloc(0)
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 8) {
        const length = buffer.readUInt16BE(4)
        if (buffer.length < 6 + length) break
        const frame = buffer.subarray(0, 6 + length)
        buffer = buffer.subarray(6 + length)
        const transactionId = frame.readUInt16BE(0)
        const unitId = frame[6]
        const functionCode = frame[7]
        const address = frame.readUInt16BE(8)
        const quantity = frame.readUInt16BE(10)
        const header = Buffer.alloc(7)
        header.writeUInt16BE(transactionId, 0)
        header.writeUInt16BE(0, 2)
        header.writeUInt16BE(functionCode === 3 ? 3 + quantity * 2 : 6, 4)
        header[6] = unitId
        if (functionCode === 3) {
          const body = Buffer.alloc(2 + quantity * 2)
          body[0] = functionCode
          body[1] = quantity * 2
          for (let i = 0; i < quantity; i += 1) body.writeUInt16BE(registers[address + i], 2 + i * 2)
          socket.write(Buffer.concat([header, body]))
        } else if (functionCode === 6) {
          const value = frame.readUInt16BE(10)
          registers[address] = value
          socket.write(Buffer.concat([header, frame.subarray(7, 12)]))
        }
      }
    })
  })
}

test("validates addresses, quantity and unit id", async () => {
  await assert.rejects(
    adapter.create({ host: "127.0.0.1", port: 1, unitId: 300, address: 0, quantity: 1 }, () => {}),
    /unitId/
  )
  await assert.rejects(
    adapter.create({ host: "127.0.0.1", port: 1, unitId: 1, address: 70000, quantity: 1 }, () => {}),
    /address/
  )
  await assert.rejects(
    adapter.create({ host: "127.0.0.1", port: 1, unitId: 1, address: 0, quantity: 0 }, () => {}),
    /quantity/
  )
})

test("reads holding registers", async () => {
  const registers = [1, 2, 3, 4]
  const server = modbusServer(registers)
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve))
  const events = []
  const session = await adapter.create(
    {
      host: "127.0.0.1",
      port: server.address().port,
      unitId: 1,
      action: "readHoldingRegisters",
      address: 0,
      quantity: 4,
    },
    event => events.push(event)
  )
  session.send()
  await new Promise(resolve => setTimeout(resolve, 100))
  const data = events.find(event => event.type === "data")
  assert.deepEqual(JSON.parse(data.payload.data).data, [1, 2, 3, 4])
  session.close()
  await new Promise(resolve => server.close(resolve))
})
