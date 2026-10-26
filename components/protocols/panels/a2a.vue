<template>
  <div class="panel">
    <div class="panel-actions">
      <label class="panel-check">
        <input v-model="viaAgent" type="checkbox" :disabled="agentStatus !== 'connected'" />
        {{ $t("via_agent") }}
      </label>
      <button :disabled="busy" @click="fetchCard">{{ $t("fetch_card") }}</button>
      <button :disabled="busy || !fields.baseUrl" @click="sendMessage">
        {{ $t("send_message") }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.panel-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px 4px;
}

.panel-actions button {
  margin-right: 8px;
}

.panel-check {
  margin-right: 12px;
  color: var(--fg-light-color);
  font-size: 14px;
}
</style>

<script>
import { agentClient } from "~/functions/agent-client.mjs"
import { agentFetchFromSettings } from "~/functions/agent-http.mjs"
import { fetchAgentCard, sendA2AMessage } from "~/functions/a2a.mjs"

export default {
  props: {
    fields: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      busy: false,
      viaAgent: false,
      agentStatus: agentClient.status,
    }
  },
  mounted() {
    agentClient.addEventListener("status", this.onStatus)
  },
  beforeDestroy() {
    agentClient.removeEventListener("status", this.onStatus)
  },
  methods: {
    onStatus(event) {
      this.agentStatus = (event.detail && event.detail.status) || "disconnected"
    },
    log(message) {
      this.$emit("log", { direction: "info", message })
    },
    fail(error) {
      this.$emit("log", { direction: "error", message: (error && error.message) || String(error) })
    },
    fetchImpl() {
      return this.viaAgent ? agentFetchFromSettings() : undefined
    },
    async fetchCard() {
      this.busy = true
      try {
        const card = await fetchAgentCard(this.fields.baseUrl, { fetchImpl: this.fetchImpl() })
        this.log(JSON.stringify(card, null, 2))
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
    async sendMessage() {
      this.busy = true
      try {
        const result = await sendA2AMessage({
          endpoint: this.fields.baseUrl,
          message: this.fields.message || "",
          contextId: this.fields.contextId,
          fetchImpl: this.fetchImpl(),
        })
        this.log(JSON.stringify(result, null, 2))
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
  },
}
</script>
