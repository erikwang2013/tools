const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

let opcua

// node-opcua's default certificate generator can fail on OpenSSL 3. Security
// mode None still initializes a client certificate, so create a minimal one.
function ensureCertificate() {
  const dir = path.join(os.homedir(), ".postwoman-agent", "opcua")
  const certificateFile = path.join(dir, "cert.pem")
  const privateKeyFile = path.join(dir, "key.pem")
  if (fs.existsSync(certificateFile) && fs.existsSync(privateKeyFile)) {
    return { certificateFile, privateKeyFile }
  }
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    const result = spawnSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        privateKeyFile,
        "-out",
        certificateFile,
        "-days",
        "3650",
        "-subj",
        "/CN=postwoman-agent",
        "-addext",
        "subjectAltName=URI:urn:postwoman-agent",
      ],
      { stdio: "ignore" }
    )
    if (result.status === 0) return { certificateFile, privateKeyFile }
  } catch {}
  return null
}

function loadOpcua() {
  // The full node-opcua meta-package pulls in nodeset XML files; the client
  // package exports the same client, enums and attribute ids without them.
  if (!opcua) opcua = require("node-opcua-client")
  return opcua
}

function unsupported(error) {
  const failure = new Error(
    `OPC UA is not available in this runtime: ${error ? error.message : "node-opcua is not installed"}`
  )
  failure.code = "UNSUPPORTED"
  return failure
}

function dataTypeFor(value) {
  if (typeof value === "boolean") return opcua.DataType.Boolean
  if (typeof value === "number") {
    return Number.isInteger(value) ? opcua.DataType.Int32 : opcua.DataType.Double
  }
  return opcua.DataType.String
}

module.exports = {
  id: "opcua",
  create(config = {}, emit) {
    try {
      loadOpcua()
    } catch (error) {
      return Promise.reject(unsupported(error))
    }
    if (!config.endpointUrl) return Promise.reject(new Error("endpointUrl is required"))
    const action = config.action || "read"
    if (!["browse", "read", "write"].includes(action)) {
      return Promise.reject(new Error("unsupported action"))
    }
    const certificate = ensureCertificate()
    const client = opcua.OPCUAClient.create({
      endpointMustExist: false,
      securityMode: opcua.MessageSecurityMode.None,
      securityPolicy: opcua.SecurityPolicy.None,
      applicationName: "Postwoman Agent",
      applicationUri: "urn:postwoman-agent",
      ...(certificate || {}),
      connectionStrategy: { initialDelay: 1000, maxRetry: 2 },
    })
    let session
    let closed = false

    return Promise.race([
      client.connect(config.endpointUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error("OPC UA connect timed out")), 30000)),
    ])
      .then(async () => {
        session = config.username
          ? await client.createSession({ userName: config.username, password: config.password || "" })
          : await client.createSession()
        return {
          ready: { endpointUrl: config.endpointUrl },
          async send() {
            if (closed) throw new Error("session closed")
            if (!config.nodeId) throw new Error("nodeId is required")
            if (action === "browse") {
              const result = await session.browse(config.nodeId)
              emit({
                type: "data",
                payload: {
                  encoding: "utf8",
                  data: JSON.stringify(
                    (result.references || []).map(reference => ({
                      nodeId: reference.nodeId.toString(),
                      browseName: reference.browseName.toString(),
                    })),
                    null,
                    2
                  ),
                },
              })
              return
            }
            if (action === "read") {
              const dataValue = await session.readVariableValue(config.nodeId)
              const value = dataValue.value ? dataValue.value.value : null
              emit({
                type: "data",
                payload: {
                  encoding: "utf8",
                  data: JSON.stringify({ statusCode: dataValue.statusCode.toString(), value }),
                },
              })
              return
            }
            const value = config.value === undefined ? "" : config.value
            const statusCode = await session.write({
              nodeId: config.nodeId,
              attributeId: opcua.AttributeIds.Value,
              value: {
                value: {
                  dataType: dataTypeFor(value),
                  value,
                },
              },
            })
            emit({
              type: "data",
              payload: { encoding: "utf8", data: JSON.stringify({ statusCode: statusCode.toString() }) },
            })
          },
          async close() {
            if (closed) return
            closed = true
            try {
              if (session) await session.close()
              await client.disconnect()
            } catch {}
          },
        }
      })
      .catch(async error => {
        try {
          await client.disconnect()
        } catch {}
        throw error
      })
  },
}
