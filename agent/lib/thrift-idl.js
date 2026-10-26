const { parse } = require("@creditkarma/thrift-parser")

const BASIC_TYPES = {
  BoolKeyword: "bool",
  ByteKeyword: "byte",
  I8Keyword: "byte",
  I16Keyword: "i16",
  I32Keyword: "i32",
  I64Keyword: "i64",
  DoubleKeyword: "double",
  StringKeyword: "string",
}

function typeName(node, structs = new Set()) {
  if (!node) throw new Error("Missing Thrift type")
  if (BASIC_TYPES[node.type]) return BASIC_TYPES[node.type]
  if (node.type === "ListType") return `list<${typeName(node.valueType, structs)}>`
  if (node.type === "SetType") return `set<${typeName(node.valueType, structs)}>`
  if (node.type === "MapType") {
    return `map<${typeName(node.keyType, structs)},${typeName(node.valueType, structs)}>`
  }
  if (node.type === "Identifier") {
    if (!structs.has(node.value)) throw new Error(`Unsupported Thrift type ${node.value}`)
    return `struct:${node.value}`
  }
  const name = String(node.type || "unknown")
    .replace(/Keyword$/, "")
    .toLowerCase()
  throw new Error(`Unsupported Thrift type ${name}`)
}

function fieldsOf(fields, structs) {
  return (fields || []).map(field => ({
    id: field.fieldID.value,
    name: field.name.value,
    type: typeName(field.fieldType, structs),
  }))
}

function parseThriftIdl(source) {
  let ast
  try {
    ast = parse(source, {})
  } catch (error) {
    throw new Error(`Thrift IDL parse error: ${error.message}`)
  }
  const structNames = new Set(
    ast.body.filter(node => node.type === "StructDefinition").map(node => node.name.value)
  )
  const services = {}
  const structs = {}
  for (const node of ast.body) {
    if (node.type === "ServiceDefinition") {
      services[node.name.value] = {
        methods: node.functions.map(fn => ({
          name: fn.name.value,
          returnType: typeName(fn.returnType, structNames),
          args: fieldsOf(fn.fields, structNames),
        })),
      }
    } else if (node.type === "StructDefinition") {
      structs[node.name.value] = { fields: fieldsOf(node.fields, structNames) }
    }
  }
  return { services, structs }
}

module.exports = { parseThriftIdl }
