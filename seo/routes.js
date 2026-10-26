const SITE_URL = "https://tools.erik.xyz"

// Shared by the layout (client-side navigation) and the generate hook (SPA shells).
const ROUTES = {
  "/": {
    title: "API 请求调试与多协议工作台",
    description:
      "免费、随开即用的 API 调试工具：REST、GraphQL、WebSocket、SSE、Socket.IO、MQTT，以及 TCP/UDP、SOAP、gRPC、Kafka、Modbus、OPC UA 等 39 种协议。",
  },
  "/realtime": {
    title: "实时连接调试",
    description: "在线调试 WebSocket、SSE、Socket.IO 和 MQTT，实时查看连接状态、收发消息与日志。",
  },
  "/protocols": {
    title: "协议实验台",
    description:
      "38 个协议条目：HTTP 家族、TCP/UDP、RTSP/RTMP、gRPC、Kafka、Modbus、OPC UA 等；浏览器原生协议直连，原始协议通过本地 Agent。",
  },
  "/graphql": {
    title: "GraphQL 调试",
    description: "获取 GraphQL schema，编辑查询与变量，查看响应和字段文档。",
  },
  "/doc": {
    title: "集合文档生成",
    description: "导入 Postwoman 集合，生成可分享的 API 文档。",
  },
  "/settings": {
    title: "设置",
    description: "配置主题、代理、浏览器扩展和本地 Agent。",
  },
  "/guide": {
    title: "使用指南",
    description: "Postwoman 快速开始、实时连接、协议实验台、本地 Agent 和快捷键教程。",
  },
}

const GUIDE_HOWTO = {
  name: "快速开始",
  steps: ["选择请求方法，输入 URL。", "按需添加 Headers、参数、认证或请求体；集合和历史记录在右侧面板。", "点击发送（或 Ctrl/⌘ G），查看响应状态、头和耗时。"],
}

module.exports = { SITE_URL, ROUTES, GUIDE_HOWTO }
