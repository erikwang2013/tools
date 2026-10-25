<template>
  <div class="panel">
    <div class="panel-actions">
      <button :disabled="busy || connected" @click="connect">{{ $t("connect") }}</button>
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

export default {
  props: {
    fields: { type: Object, required: true },
  },
  data() {
    return {
      busy: false,
      connected: false,
      client: null,
      xml: null,
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
        const module = await import("@xmpp/client")
        const xmpp = module.default || module
        let service = this.fields.serviceUrl
        if (this.fields.transport === "agent") {
          const opened = await agentClient.open("ws-bridge", { targetUrl: this.fields.serviceUrl })
          this.bridgeSessionId = opened.sessionId
          service = opened.payload.url
        }
        const [username, domain] = String(this.fields.jid || "").split("@")
        if (!username || !domain) throw new Error("JID must be user@domain")
        this.xml = xmpp.xml
        this.client = xmpp.client({
          service,
          domain,
          username,
          password: this.fields.password,
        })
        this.client.on("stanza", stanza => this.log(stanza.toString(), "received"))
        this.client.on("error", error => this.fail(error))
        this.client.on("offline", () => {
          this.connected = false
          this.log("XMPP offline")
        })
        await this.client.start()
        this.connected = true
        this.log("XMPP connected")
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
    async send() {
      if (!this.client || !this.xml) return
      this.busy = true
      try {
        this.client.send(
          this.xml("message", { to: this.fields.to }, this.xml("body", {}, this.fields.message || ""))
        )
        this.log(`Message sent to ${this.fields.to}`, "sent")
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
    async disconnect() {
      if (this.client) await this.client.stop().catch(() => {})
      this.client = null
      this.connected = false
      if (this.bridgeSessionId) agentClient.close(this.bridgeSessionId).catch(() => {})
      this.bridgeSessionId = null
    },
  },
}
</script>
