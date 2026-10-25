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
      userAgent: null,
      registerer: null,
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
        const module = await import("sip.js")
        const sip = module.default || module
        let server = this.fields.wsUrl
        if (this.fields.transport === "agent") {
          const opened = await agentClient.open("ws-bridge", { targetUrl: this.fields.wsUrl })
          this.bridgeSessionId = opened.sessionId
          server = opened.payload.url
        }
        const user = this.fields.authUser
        const domain = String(this.fields.sipUri || "").split("@")[1]
        if (!user || !domain) throw new Error("SIP URI must be user@domain")
        const uri = sip.UserAgent.makeURI(`sip:${user}@${domain}`)
        this.userAgent = new sip.UserAgent({ uri, transportOptions: { server } })
        await this.userAgent.start()
        this.registerer = new sip.Registerer(this.userAgent)
        this.registerer.stateChange.addListener(state => this.log(`Registerer: ${state}`))
        await this.registerer.register()
        this.connected = true
        this.log("SIP connected")
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
    async send() {
      if (!this.userAgent) return
      this.busy = true
      try {
        const module = await import("sip.js")
        const sip = module.default || module
        const target = sip.UserAgent.makeURI(this.fields.targetUri)
        const messager = new sip.Messager(this.userAgent, target, this.fields.message || "", "text/plain")
        await messager.message()
        this.log(`MESSAGE sent to ${this.fields.targetUri}`, "sent")
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
    async disconnect() {
      if (this.registerer) await this.registerer.unregister().catch(() => {})
      if (this.userAgent) await this.userAgent.stop().catch(() => {})
      this.registerer = null
      this.userAgent = null
      this.connected = false
      if (this.bridgeSessionId) agentClient.close(this.bridgeSessionId).catch(() => {})
      this.bridgeSessionId = null
    },
  },
}
</script>
