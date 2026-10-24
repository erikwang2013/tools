export const GROUPS = [
  "HTTP",
  "Browser Realtime",
  "Raw & Streaming",
  "RPC & Messaging",
  "IoT / Industrial",
  "Agent",
]

export const protocols = [
  {
    id: "tcp",
    label: "TCP",
    group: "Raw & Streaming",
    transport: "agent",
    fields: [
      { key: "host", label: "Host", type: "text", default: "127.0.0.1", required: true },
      { key: "port", label: "Port", type: "number", default: 9000, required: true },
      {
        key: "encoding",
        label: "Receive as",
        type: "select",
        options: ["base64", "utf8"],
        default: "base64",
      },
    ],
    payload: "binary",
    actions: ["connect", "send", "close"],
    panel: null,
    agentFallback: false,
    buildRequest: null,
  },
  {
    id: "udp",
    label: "UDP",
    group: "Raw & Streaming",
    transport: "agent",
    fields: [
      { key: "host", label: "Host", type: "text", default: "127.0.0.1", required: true },
      { key: "port", label: "Port", type: "number", default: 9000, required: true },
      { key: "bindPort", label: "Bind Port", type: "number", default: 0 },
      {
        key: "encoding",
        label: "Receive as",
        type: "select",
        options: ["base64", "utf8"],
        default: "base64",
      },
    ],
    payload: "binary",
    actions: ["connect", "send", "close"],
    panel: null,
    agentFallback: false,
    buildRequest: null,
  },
]

export function getProtocol(id) {
  return protocols.find(p => p.id === id)
}
