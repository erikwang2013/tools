<template>
  <div class="panel">
    <div class="panel-actions">
      <button :disabled="busy || connected" @click="connect">{{ $t("connect") }}</button>
      <button :disabled="busy || !connected" @click="subscribe">{{ $t("subscribe") }}</button>
      <button :disabled="busy || !connected" @click="send">{{ $t("send") }}</button>
      <button :disabled="busy || !connected" @click="disconnect">{{ $t("disconnect") }}</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.panel-actions {
  display: flex;
  flex-wrap: wrap;
  padding: 8px 4px;
}

.panel-actions button {
  margin-right: 8px;
}
</style>

<script>
import { agentClient } from "~/functions/agent-client.mjs"
import { base64ToBytes, bytesToHex } from "~/functions/bytes.mjs"
import { editorToWire } from "~/functions/payload.mjs"
import { formatFrameLog } from "~/functions/stomp-panel.mjs"

export default {
  props: {
    fields: { type: Object, required: true },
    payload: { type: Object, default: () => ({}) },
  },
  data() {
    return {
      busy: false,
      connected: false,
      client: null,
      subscription: null,
      bridgeSessionId: null,
    }
  },
  beforeDestroy() {
    this.disconnect()
  },
  methods: {
    log(message, direction = "info") {
      this.$emit("log", { direction, message })
    },
    fail(error) {
      this.log((error && error.message) || String(error), "error")
    },
    async connect() {
      this.busy = true
      try {
        const module = await import("@stomp/stompjs")
        const Client = module.Client
        let brokerURL = this.fields.brokerUrl
        if (this.fields.transport === "agent") {
          const opened = await agentClient.open("ws-bridge", {
            targetUrl: this.fields.brokerUrl,
            headers: this.fields.connectHeaders || {},
          })
          this.bridgeSessionId = opened.sessionId
          brokerURL = opened.payload.url
        }
        this.client = new Client({
          brokerURL,
          connectHeaders: this.fields.connectHeaders || {},
          reconnectDelay: 0,
          onConnect: () => {
            this.connected = true
            this.log("STOMP connected")
          },
          onStompError: frame => this.fail(new Error(frame.headers.message || "STOMP error")),
          onWebSocketError: event => this.fail(new Error(event.message || "WebSocket error")),
          onWebSocketClose: () => {
            this.connected = false
            this.log("WebSocket closed")
          },
        })
        this.client.activate()
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
    subscribe() {
      if (!this.client || !this.fields.subscribeDestination) return
      if (this.subscription) this.subscription.unsubscribe()
      this.subscription = this.client.subscribe(this.fields.subscribeDestination, message => {
        const body = message.binaryBody ? bytesToHex(message.binaryBody) : message.body
        this.log(formatFrameLog({ command: "MESSAGE", headers: message.headers, body }), "received")
      })
      this.log(`Subscribed to ${this.fields.subscribeDestination}`)
    },
    send() {
      if (!this.client) return
      const wire = editorToWire(this.payload)
      const frame = { destination: this.fields.sendDestination }
      if (wire && wire.encoding === "base64") frame.binaryBody = base64ToBytes(wire.data)
      else if (wire) frame.body = wire.data
      this.client.publish(frame)
      this.log(
        formatFrameLog({
          command: "SEND",
          headers: { destination: frame.destination },
          body: frame.body || (frame.binaryBody ? bytesToHex(frame.binaryBody) : ""),
        }),
        "sent"
      )
    },
    async disconnect() {
      if (this.subscription) this.subscription.unsubscribe()
      this.subscription = null
      if (this.client) await this.client.deactivate().catch(() => {})
      this.client = null
      this.connected = false
      if (this.bridgeSessionId) agentClient.close(this.bridgeSessionId).catch(() => {})
      this.bridgeSessionId = null
    },
  },
}
</script>
