const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const grpc = require("@grpc/grpc-js")
const protoLoader = require("@grpc/proto-loader")

function findService(definition, fullName) {
  let node = definition
  for (const part of String(fullName || "").split(".")) {
    node = node && node[part]
  }
  return typeof node === "function" ? node : null
}

function findMethod(service, name) {
  const definition = service.service || {}
  if (definition[name]) return { key: name, def: definition[name] }
  const key = Object.keys(definition).find(item => item.toLowerCase() === String(name).toLowerCase())
  return key ? { key, def: definition[key] } : null
}

module.exports = {
  id: "grpc",
  create(config = {}, emit) {
    if (!config.target) return Promise.reject(new Error("target is required"))
    if (!config.proto) return Promise.reject(new Error("proto is required"))
    if (!config.service) return Promise.reject(new Error("service is required"))

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "postwoman-grpc-"))
    const file = path.join(dir, "service.proto")
    let definition
    try {
      fs.writeFileSync(file, config.proto)
      const loaded = protoLoader.loadSync(file, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      })
      definition = grpc.loadPackageDefinition(loaded)
    } catch (error) {
      return Promise.reject(error)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }

    const Service = findService(definition, config.service)
    if (!Service) return Promise.reject(new Error(`Service ${config.service} not found`))
    const method = findMethod(Service, config.method || "")
    if (!method) return Promise.reject(new Error(`Method ${config.method} not found`))
    if (method.def.requestStream) return Promise.reject(new Error("Unsupported method type"))

    const credentials = config.tls
      ? grpc.credentials.createSsl(null, null, null, {
          rejectUnauthorized: !config.allowSelfSigned,
        })
      : grpc.credentials.createInsecure()
    const client = new Service(config.target, credentials)
    const metadata = new grpc.Metadata()
    for (const [key, value] of Object.entries(config.metadata || {})) metadata.set(key, String(value))
    let call = null

    return Promise.resolve({
      ready: {
        service: config.service,
        method: method.key,
        streaming: Boolean(method.def.responseStream),
      },
      send(payload) {
        let request
        try {
          request = JSON.parse(payload && payload.encoding === "utf8" ? payload.data : "{}")
        } catch {
          throw new Error("gRPC payload must be JSON")
        }
        if (method.def.responseStream) {
          call = client[method.key](request, metadata)
          call.on("data", response => {
            emit({ type: "data", payload: { encoding: "utf8", data: JSON.stringify(response) } })
          })
          call.on("end", () => emit({ type: "closed", payload: { reason: "stream ended" } }))
          call.on("error", error => {
            emit({ type: "error", payload: { message: error.message } })
            emit({ type: "closed", payload: { reason: error.message } })
          })
          return
        }
        call = client[method.key](request, metadata, (error, response) => {
          if (error) {
            emit({ type: "error", payload: { message: error.message } })
            emit({ type: "closed", payload: { reason: error.message } })
            return
          }
          emit({ type: "data", payload: { encoding: "utf8", data: JSON.stringify(response) } })
          emit({ type: "closed", payload: { reason: "response complete" } })
        })
      },
      close() {
        if (call) {
          try {
            call.cancel()
          } catch {}
        }
        client.close()
      },
    })
  },
}
