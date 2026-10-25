<template>
  <div class="panel">
    <div class="panel-actions">
      <label class="panel-check">
        <input v-model="viaAgent" type="checkbox" :disabled="agentStatus !== 'connected'" />
        {{ $t("via_agent") }}
      </label>
      <button :disabled="busy" @click="connect">{{ $t("connect") }}</button>
      <button :disabled="busy || !connected" @click="listTools">{{ $t("list_tools") }}</button>
    </div>
    <div class="panel-actions">
      <select v-model="selectedTool" :disabled="!tools.length">
        <option value="">{{ $t("tools") }}</option>
        <option v-for="tool in tools" :key="tool.name" :value="tool.name">{{ tool.name }}</option>
      </select>
      <input v-model="args" type="text" spellcheck="false" :aria-label="$t('tool_args')" />
      <button :disabled="busy || !selectedTool" @click="callTool">{{ $t("call_tool") }}</button>
      <button :disabled="busy || !connected" @click="disconnect">{{ $t("close") }}</button>
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

.panel-actions > * {
  margin-right: 8px;
}

.panel-check {
  color: var(--fg-light-color);
  font-size: 14px;
}
</style>

<script>
import { agentClient } from "~/functions/agent-client.mjs"
import { agentFetchFromSettings } from "~/functions/agent-http.mjs"
import { McpRemoteClient } from "~/functions/mcp-remote.mjs"

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
      client: null,
      stdioSessionId: null,
      tools: [],
      selectedTool: "",
      args: "{}",
      nextId: 1,
    }
  },
  computed: {
    connected() {
      return Boolean(this.client || this.stdioSessionId)
    },
  },
  mounted() {
    agentClient.addEventListener("status", this.onStatus)
    agentClient.addEventListener("session", this.onSession)
  },
  beforeDestroy() {
    agentClient.removeEventListener("status", this.onStatus)
    agentClient.removeEventListener("session", this.onSession)
    this.disconnect()
  },
  methods: {
    onStatus(event) {
      this.agentStatus = (event.detail && event.detail.status) || "disconnected"
    },
    log(message, direction = "info") {
      this.$emit("log", { direction, message })
    },
    fail(error) {
      this.log((error && error.message) || String(error), "error")
    },
    fetchImpl() {
      return this.viaAgent ? agentFetchFromSettings() : undefined
    },
    async connect() {
      this.busy = true
      try {
        if (this.fields.transport === "stdio") {
          await this.connectStdio()
        } else {
          this.client = new McpRemoteClient({
            url: this.fields.url,
            headers: this.fields.headers || {},
            fetchImpl: this.fetchImpl(),
          })
          await this.client.initialize()
          this.tools = await this.client.listTools()
          this.log(`initialized; ${this.tools.length} tools`)
        }
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
    async connectStdio() {
      if (this.agentStatus !== "connected") throw new Error("Connect the local agent in Settings first")
      const { sessionId } = await agentClient.open("mcp-stdio", { server: this.fields.server })
      this.stdioSessionId = sessionId
      this.sendStdio({ jsonrpc: "2.0", id: this.nextId++, method: "initialize", params: {} })
    },
    sendStdio(message) {
      return agentClient.send(this.stdioSessionId, {
        encoding: "utf8",
        data: JSON.stringify(message),
      })
    },
    onSession(event) {
      const detail = event.detail || {}
      if (detail.sessionId !== this.stdioSessionId) return
      const payload = detail.payload || {}
      if (detail.type === "data") {
        let message
        try {
          message = JSON.parse(payload.data)
        } catch {
          return
        }
        if (message.result && message.result.tools) this.tools = message.result.tools
        this.log(JSON.stringify(message, null, 2), detail.type === "error" ? "error" : "received")
      } else if (detail.type === "error") {
        this.fail(payload.message)
      } else if (detail.type === "closed") {
        this.log(payload.reason || "closed")
        this.stdioSessionId = null
      }
    },
    async listTools() {
      this.busy = true
      try {
        if (this.client) {
          this.tools = await this.client.listTools()
        } else {
          this.sendStdio({ jsonrpc: "2.0", id: this.nextId++, method: "tools/list", params: {} })
          return
        }
        this.log(`${this.tools.length} tools`)
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
    async callTool() {
      let parsed
      try {
        parsed = JSON.parse(this.args || "{}")
      } catch {
        return this.fail(new Error("Tool args must be JSON"))
      }
      this.busy = true
      try {
        if (this.client) {
          const result = await this.client.callTool(this.selectedTool, parsed)
          this.log(JSON.stringify(result, null, 2), "received")
        } else {
          this.sendStdio({
            jsonrpc: "2.0",
            id: this.nextId++,
            method: "tools/call",
            params: { name: this.selectedTool, arguments: parsed },
          })
        }
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
    disconnect() {
      if (this.client) this.client.close()
      this.client = null
      if (this.stdioSessionId) agentClient.close(this.stdioSessionId).catch(() => {})
      this.stdioSessionId = null
    },
  },
}
</script>
