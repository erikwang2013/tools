const TYPE_CODES = {
  bool: 2,
  byte: 3,
  double: 4,
  i16: 6,
  i32: 8,
  i64: 10,
  string: 11,
  struct: 12,
  map: 13,
  set: 14,
  list: 15,
}
const VERSION_1 = 0x80010000
const CALL = 1
const REPLY = 2
const EXCEPTION = 3

function typeCode(type) {
  if (type.startsWith("list<")) return TYPE_CODES.list
  if (type.startsWith("set<")) return TYPE_CODES.set
  if (type.startsWith("map<")) return TYPE_CODES.map
  if (type.startsWith("struct:")) return TYPE_CODES.struct
  const code = TYPE_CODES[type]
  if (!code) throw new Error(`Unsupported Thrift type ${type}`)
  return code
}

class Writer {
  constructor() {
    this.chunks = []
  }
  i8(value) {
    this.chunks.push(Buffer.from([value & 0xff]))
  }
  i16(value) {
    const buffer = Buffer.alloc(2)
    buffer.writeInt16BE(value)
    this.chunks.push(buffer)
  }
  i32(value) {
    const buffer = Buffer.alloc(4)
    buffer.writeInt32BE(value)
    this.chunks.push(buffer)
  }
  u32(value) {
    const buffer = Buffer.alloc(4)
    buffer.writeUInt32BE(value >>> 0)
    this.chunks.push(buffer)
  }
  i64(value) {
    const buffer = Buffer.alloc(8)
    buffer.writeBigInt64BE(BigInt(value))
    this.chunks.push(buffer)
  }
  double(value) {
    const buffer = Buffer.alloc(8)
    buffer.writeDoubleBE(value)
    this.chunks.push(buffer)
  }
  string(value) {
    const bytes = Buffer.from(String(value), "utf8")
    this.i32(bytes.length)
    this.chunks.push(bytes)
  }
  concat() {
    return Buffer.concat(this.chunks)
  }
}

class Reader {
  constructor(buffer) {
    this.buffer = buffer
    this.offset = 0
  }
  require(size) {
    if (this.offset + size > this.buffer.length) throw new Error("Incomplete Thrift message")
  }
  i8() {
    this.require(1)
    return this.buffer.readInt8(this.offset++)
  }
  i16() {
    this.require(2)
    const value = this.buffer.readInt16BE(this.offset)
    this.offset += 2
    return value
  }
  i32() {
    this.require(4)
    const value = this.buffer.readInt32BE(this.offset)
    this.offset += 4
    return value
  }
  u32() {
    this.require(4)
    const value = this.buffer.readUInt32BE(this.offset)
    this.offset += 4
    return value
  }
  i64() {
    this.require(8)
    const value = this.buffer.readBigInt64BE(this.offset)
    this.offset += 8
    return value
  }
  double() {
    this.require(8)
    const value = this.buffer.readDoubleBE(this.offset)
    this.offset += 8
    return value
  }
  string() {
    const length = this.i32()
    this.require(length)
    const value = this.buffer.subarray(this.offset, this.offset + length).toString("utf8")
    this.offset += length
    return value
  }
}

function writeValue(writer, type, value, structs) {
  if (type === "bool") return writer.i8(value ? 1 : 0)
  if (type === "byte") return writer.i8(Number(value))
  if (type === "i16") return writer.i16(Number(value))
  if (type === "i32") return writer.i32(Number(value))
  if (type === "i64") return writer.i64(value)
  if (type === "double") return writer.double(Number(value))
  if (type === "string") return writer.string(value == null ? "" : value)
  if (type.startsWith("list<") || type.startsWith("set<")) {
    const inner = type.slice(type.indexOf("<") + 1, -1)
    const values = Array.isArray(value) ? value : []
    writer.i8(typeCode(inner))
    writer.i32(values.length)
    for (const item of values) writeValue(writer, inner, item, structs)
    return
  }
  if (type.startsWith("map<")) {
    const [keyType, valueType] = type.slice(4, -1).split(",")
    const entries = value && typeof value === "object" ? Object.entries(value) : []
    writer.i8(typeCode(keyType))
    writer.i8(typeCode(valueType))
    writer.i32(entries.length)
    for (const [key, item] of entries) {
      writeValue(writer, keyType, key, structs)
      writeValue(writer, valueType, item, structs)
    }
    return
  }
  if (type.startsWith("struct:")) {
    const name = type.slice(7)
    const definition = structs[name]
    if (!definition) throw new Error(`Unknown Thrift struct ${name}`)
    writeStruct(writer, definition, value || {}, structs)
    return
  }
  throw new Error(`Unsupported Thrift type ${type}`)
}

function writeStruct(writer, definition, value, structs) {
  for (const field of definition.fields) {
    if (value[field.name] === undefined) continue
    const code = typeCode(field.type)
    writer.i8(code)
    writer.i16(field.id)
    writeValue(writer, field.type, value[field.name], structs)
  }
  writer.i8(0)
}

function readValue(reader, code, structs) {
  switch (code) {
    case TYPE_CODES.bool:
      return reader.i8() !== 0
    case TYPE_CODES.byte:
      return reader.i8()
    case TYPE_CODES.i16:
      return reader.i16()
    case TYPE_CODES.i32:
      return reader.i32()
    case TYPE_CODES.i64:
      return reader.i64().toString()
    case TYPE_CODES.double:
      return reader.double()
    case TYPE_CODES.string:
      return reader.string()
    case TYPE_CODES.list:
    case TYPE_CODES.set: {
      const inner = reader.i8()
      const size = reader.i32()
      const values = []
      for (let i = 0; i < size; i += 1) values.push(readValue(reader, inner, structs))
      return values
    }
    case TYPE_CODES.map: {
      const keyCode = reader.i8()
      const valueCode = reader.i8()
      const size = reader.i32()
      const value = {}
      for (let i = 0; i < size; i += 1) {
        const key = readValue(reader, keyCode, structs)
        value[String(key)] = readValue(reader, valueCode, structs)
      }
      return value
    }
    case TYPE_CODES.struct:
      return readStruct(reader, null, structs)
    default:
      throw new Error(`Unsupported Thrift field type ${code}`)
  }
}

function readStruct(reader, definition, structs) {
  const value = {}
  const byId = new Map((definition ? definition.fields : []).map(field => [field.id, field]))
  for (;;) {
    const code = reader.i8()
    if (code === 0) break
    const id = reader.i16()
    const field = byId.get(id)
    const item = readValue(reader, code, structs)
    value[field ? field.name : id] = item
  }
  return value
}

function encodeThriftCall({ service, method, args = {}, proto }) {
  const serviceDef = proto.services[service]
  if (!serviceDef) throw new Error(`Service ${service} not found`)
  const methodDef = serviceDef.methods.find(item => item.name === method)
  if (!methodDef) throw new Error(`Method ${method} not found`)
  const writer = new Writer()
  writer.u32(VERSION_1 | CALL)
  writer.string(method)
  writer.i32(1)
  for (const arg of methodDef.args) {
    const value = Array.isArray(args) ? args[methodDef.args.indexOf(arg)] : args[arg.name]
    if (value === undefined) continue
    writer.i8(typeCode(arg.type))
    writer.i16(arg.id)
    writeValue(writer, arg.type, value, proto.structs)
  }
  writer.i8(0)
  return writer.concat()
}

function encodeThriftReply({ name, returnType, value, structs = {}, seqid = 1 }) {
  const writer = new Writer()
  writer.u32(VERSION_1 | REPLY)
  writer.string(name)
  writer.i32(seqid)
  writer.i8(typeCode(returnType))
  writer.i16(0)
  writeValue(writer, returnType, value, structs)
  writer.i8(0)
  return writer.concat()
}

function decodeThriftResult(buffer, { method, proto } = {}) {
  const reader = new Reader(buffer)
  const header = reader.u32()
  if ((header & 0xffff0000) >>> 0 !== VERSION_1 >>> 0) throw new Error("Unsupported Thrift protocol version")
  const type = header & 0xff
  const name = reader.string()
  reader.i32()
  let value
  let error = null
  for (;;) {
    const code = reader.i8()
    if (code === 0) break
    const id = reader.i16()
    const item = readValue(reader, code, (proto && proto.structs) || {})
    if (id === 0 && type !== EXCEPTION) value = item
    else error = item
  }
  if (error) {
    const message = error && error.message ? error.message : `Thrift exception in ${method || name}`
    const exception = new Error(message)
    exception.thrift = error
    throw exception
  }
  return { value, consumed: reader.offset }
}

module.exports = {
  TYPE_CODES,
  encodeThriftCall,
  encodeThriftReply,
  decodeThriftResult,
}
