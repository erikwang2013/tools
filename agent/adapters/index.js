// Adapters are required lazily: some protocol libraries take seconds to load and
// the agent should start with only the modules a session actually uses.
const loaders = {
  tcp: () => require("./tcp"),
  udp: () => require("./udp"),
  "http-proxy": () => require("./http-proxy"),
  http2: () => require("./http2"),
  http3: () => require("./http3"),
  webhooks: () => require("./webhooks"),
  "mcp-stdio": () => require("./mcp-stdio"),
  "ws-bridge": () => require("./ws-bridge"),
  "raw-socket": () => require("./raw-socket"),
  "unix-socket": () => require("./unix-socket"),
  rtp: () => require("./rtp"),
  rtcp: () => require("./rtcp"),
  rtsp: () => require("./rtsp"),
  iso8583: () => require("./iso8583"),
  rtmp: () => require("./rtmp"),
  grpc: () => require("./grpc"),
  dubbo: () => require("./dubbo"),
  thrift: () => require("./thrift"),
  hessian: () => require("./hessian"),
  amqp: () => require("./amqp"),
  kafka: () => require("./kafka"),
  "stomp-tcp": () => require("./stomp-tcp"),
  coap: () => require("./coap"),
  lwm2m: () => require("./lwm2m"),
  "modbus-tcp": () => require("./modbus"),
  iec104: () => require("./iec104"),
  dnp3: () => require("./dnp3"),
  "bacnet-ip": () => require("./bacnet"),
  opcua: () => require("./opcua"),
}

const adapters = {}
for (const [id, load] of Object.entries(loaders)) {
  Object.defineProperty(adapters, id, { enumerable: true, get: load })
}

module.exports = adapters
