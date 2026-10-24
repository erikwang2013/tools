<template>
  <div class="protocol-lab">
    <div class="lab-header">
      <strong class="lab-title">{{ protocol.label }}</strong>
      <span class="lab-transport">{{ transportLabel }}</span>
      <span v-if="isAgent" class="lab-status">{{ $t(agentStatus) }}</span>
    </div>

    <ul>
      <li v-for="field in protocol.fields" :key="field.key">
        <template v-if="field.type === 'keyvalue'">
          <label>{{ field.label }}</label>
          <div v-for="(row, index) in keyvalues[field.key]" :key="index" class="lab-kv-row">
            <input
              type="text"
              v-model="row.key"
              :aria-label="field.label + ' key'"
              @input="syncKeyvalue(field)"
            />
            <input
              type="text"
              v-model="row.value"
              :aria-label="field.label + ' value'"
              @input="syncKeyvalue(field)"
            />
            <button class="icon" :aria-label="$t('delete')" @click="removeKeyvalue(field, index)">
              <i class="material-icons">remove</i>
            </button>
          </div>
          <button class="icon" @click="addKeyvalue(field)">
            <i class="material-icons">add</i>
            <span>{{ $t("add_new") }}</span>
          </button>
        </template>

        <template v-else-if="field.type === 'checkbox'">
          <input :id="fieldId(field)" type="checkbox" v-model="fields[field.key]" />
          <label :for="fieldId(field)">{{ field.label }}</label>
        </template>

        <template v-else>
          <label :for="fieldId(field)">{{ field.label }}</label>
          <input
            v-if="field.type === 'text' || field.type === 'password'"
            :id="fieldId(field)"
            :type="field.type"
            spellcheck="false"
            v-model="fields[field.key]"
          />
          <input
            v-else-if="field.type === 'number' || field.type === 'timer'"
            :id="fieldId(field)"
            type="number"
            :min="field.type === 'timer' ? 0 : null"
            :value="fields[field.key]"
            @input="setNumber(field, $event)"
          />
          <select
            v-else-if="field.type === 'select'"
            :id="fieldId(field)"
            v-model="fields[field.key]"
          >
            <option v-for="option in field.options" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
          <textarea
            v-else-if="field.type === 'textarea'"
            :id="fieldId(field)"
            rows="3"
            spellcheck="false"
            v-model="fields[field.key]"
          ></textarea>
        </template>
      </li>
    </ul>

    <protocols-payload
      v-if="protocol.payload !== 'none'"
      :value="payload"
      :modes="payloadModes"
      @input="payload = $event"
    />

    <component v-if="panelComponent" :is="panelComponent" :protocol="protocol" :fields="fields" />
    <p v-else-if="protocol.transport === 'browser'" class="lab-hint">
      {{ $t("panel_not_implemented") }}
    </p>

    <div class="lab-actions">
      <button
        v-if="protocol.transport === 'agent' && hasAction('connect')"
        class="icon"
        :disabled="!canConnect"
        @click="connect"
      >
        <i class="material-icons">sync</i>
        <span>{{ $t("connect") }}</span>
      </button>
      <button
        v-if="protocol.transport !== 'browser' && hasAction('send')"
        class="icon"
        :disabled="!canSend"
        @click="send"
      >
        <i class="material-icons">send</i>
        <span>{{ $t("send") }}</span>
      </button>
      <button
        v-if="protocol.transport === 'agent' && hasAction('close')"
        class="icon"
        :disabled="!sessionId"
        @click="close"
      >
        <i class="material-icons">sync_disabled</i>
        <span>{{ $t("close") }}</span>
      </button>
    </div>

    <p v-if="isAgent && !agentConnected" class="lab-hint">
      <strong>{{ $t("agent_required") }}</strong>
      {{ $t("agent_offline_hint") }}
      {{ $t("start_agent_command") }}
      <code>npm run agent</code>
    </p>

    <protocols-log :entries="entries" @clear="entries = []" />
  </div>
</template>

<style scoped lang="scss">
div.protocol-lab {
  margin: 4px;
  width: calc(100% - 8px);
}

div.lab-header {
  display: flex;
  align-items: baseline;
  padding: 8px 4px;
}

.lab-title {
  margin-right: 12px;
  font-size: 18px;
}

.lab-transport {
  margin-right: 12px;
  color: var(--fg-light-color);
  font-size: 14px;
}

.lab-status {
  margin-left: auto;
  color: var(--fg-light-color);
  font-size: 14px;
}

.lab-kv-row {
  display: flex;
  align-items: center;

  input {
    margin-right: 4px;
  }
}

div.lab-actions {
  display: flex;
  padding: 8px 4px;

  button {
    margin-right: 8px;
  }
}

p.lab-hint {
  padding: 8px 4px;
  color: var(--fg-light-color);
  font-size: 14px;

  code {
    color: var(--fg-color);
  }
}
</style>

<script>
import { agentClient } from "~/functions/agent-client.mjs"
import { sendHttp } from "~/functions/http-request"
import { editorToWire } from "~/functions/payload.mjs"
import { makeLogEntry } from "~/functions/log-entry.mjs"
import ProtocolsLog from "./log.vue"
import ProtocolsPayload from "./payload.vue"

const PAYLOAD_MODES = {
  binary: ["hex", "base64", "file"],
  text: ["text"],
  json: ["json", "text"],
  xml: ["xml", "text"],
}

// Browser transport panels register here as { [descriptor.panel]: Component }.
const PANELS = {}

const TRANSPORTS = { agent: "Agent", browser: "Browser", http: "HTTP" }

export default {
  components: {
    ProtocolsLog,
    ProtocolsPayload,
  },
  props: {
    protocol: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      fields: {},
      keyvalues: {},
      payload: { mode: "", text: "", base64: "", filename: "" },
      entries: [],
      agentStatus: agentClient.status,
      sessionId: null,
      busy: false,
      generation: 0,
    }
  },
  computed: {
    isAgent() {
      return this.protocol.transport === "agent"
    },
    agentConnected() {
      return this.agentStatus === "connected"
    },
    transportLabel() {
      return TRANSPORTS[this.protocol.transport] || this.protocol.transport
    },
    payloadModes() {
      return PAYLOAD_MODES[this.protocol.payload] || ["text"]
    },
    panelComponent() {
      return PANELS[this.protocol.panel] || null
    },
    canConnect() {
      return this.isAgent && this.agentConnected && !this.sessionId && !this.busy
    },
    canSend() {
      if (this.busy) return false
      return this.isAgent ? Boolean(this.sessionId) && this.agentConnected : true
    },
  },
  watch: {
    protocol: {
      deep: true,
      handler() {
        this.resetProtocol()
      },
    },
  },
  created() {
    this.resetProtocol()
    agentClient.addEventListener("status", this.onStatus)
    agentClient.addEventListener("session", this.onSession)
  },
  beforeDestroy() {
    this.generation++
    agentClient.removeEventListener("status", this.onStatus)
    agentClient.removeEventListener("session", this.onSession)
    this.closeSession()
  },
  methods: {
    fieldId(field) {
      return `lab-${this.protocol.id}-${field.key}`
    },
    hasAction(action) {
      return (this.protocol.actions || []).indexOf(action) !== -1
    },
    setNumber(field, event) {
      const value = event.target.value
      const number = Number(value)
      this.fields[field.key] = value === "" || Number.isNaN(number) ? "" : number
    },
    keyvaluesToObject(rows) {
      const value = {}
      for (const row of rows) {
        if (row.key) value[row.key] = row.value
      }
      return value
    },
    syncKeyvalue(field) {
      this.fields[field.key] = this.keyvaluesToObject(this.keyvalues[field.key])
    },
    addKeyvalue(field) {
      this.keyvalues[field.key].push({ key: "", value: "" })
    },
    removeKeyvalue(field, index) {
      this.keyvalues[field.key].splice(index, 1)
      this.syncKeyvalue(field)
    },
    initFields() {
      const fields = {}
      const keyvalues = {}
      for (const field of this.protocol.fields || []) {
        if (field.type === "keyvalue") {
          const rows = []
          if (field.default && typeof field.default === "object") {
            for (const key of Object.keys(field.default)) {
              rows.push({ key, value: field.default[key] })
            }
          }
          if (!rows.length) rows.push({ key: "", value: "" })
          keyvalues[field.key] = rows
          fields[field.key] = this.keyvaluesToObject(rows)
        } else if (field.default !== undefined) {
          fields[field.key] = field.default
        } else if (field.type === "checkbox") {
          fields[field.key] = false
        } else if (field.type === "number" || field.type === "timer") {
          fields[field.key] = 0
        } else {
          fields[field.key] = ""
        }
      }
      this.fields = fields
      this.keyvalues = keyvalues
    },
    initPayload() {
      this.payload = { mode: this.payloadModes[0], text: "", base64: "", filename: "" }
    },
    resetProtocol() {
      this.generation++
      this.closeSession()
      this.busy = false
      this.initFields()
      this.initPayload()
      this.entries = []
    },
    push(direction, data, encoding, extra) {
      this.entries.push(makeLogEntry({ direction, encoding, data, ...extra }))
      // Spec §4.5: keep at most the last 2000 entries in memory.
      if (this.entries.length > 2000) this.entries.splice(0, this.entries.length - 2000)
    },
    logError(error) {
      this.push("error", (error && error.message) || String(error))
    },
    onStatus(event) {
      const detail = event.detail || {}
      this.agentStatus = detail.status
      if (detail.status !== "connected") this.sessionId = null
      if (detail.error) this.logError(detail.error)
    },
    onSession(event) {
      const detail = event.detail || {}
      if (detail.sessionId !== this.sessionId) return
      const payload = detail.payload || {}
      if (detail.type === "data") {
        this.push("received", payload.data == null ? "" : payload.data, payload.encoding, {
          bytes: payload.bytes,
          remote: payload.remote,
        })
      } else if (detail.type === "log") {
        const data = payload.message || JSON.stringify(payload)
        this.push(payload.level === "error" ? "error" : "info", data)
      } else if (detail.type === "error") {
        this.push("error", payload.message || this.$t("error"))
      } else if (detail.type === "closed") {
        this.push("info", payload.reason || this.$t("disconnected"))
        this.sessionId = null
      }
    },
    async connect() {
      if (!this.canConnect) return
      const generation = this.generation
      this.busy = true
      try {
        const { sessionId, payload } = await agentClient.open(this.protocol.id, this.fields)
        if (generation !== this.generation) {
          agentClient.close(sessionId).catch(() => {})
          return
        }
        this.sessionId = sessionId
        const ready = payload && Object.keys(payload).length ? ` ${JSON.stringify(payload)}` : ""
        this.push("info", `${this.$t("connected")}${ready}`)
      } catch (error) {
        if (generation === this.generation) this.logError(error)
      } finally {
        if (generation === this.generation) this.busy = false
      }
    },
    closeSession() {
      const sessionId = this.sessionId
      this.sessionId = null
      if (sessionId) agentClient.close(sessionId).catch(() => {})
    },
    async close() {
      const sessionId = this.sessionId
      if (!sessionId) return
      try {
        await agentClient.close(sessionId)
      } catch (error) {
        this.logError(error)
      }
      if (this.sessionId !== sessionId) return
      this.sessionId = null
      this.push("info", this.$t("disconnected"))
    },
    async send() {
      if (!this.canSend) return
      if (this.protocol.transport === "http") return this.sendHttpRequest(this.generation)
      if (!this.isAgent) return
      const generation = this.generation
      let wire
      try {
        wire = this.protocol.payload === "none" ? null : editorToWire(this.payload)
      } catch (error) {
        return this.logError(error)
      }
      try {
        await agentClient.send(this.sessionId, wire)
        if (generation !== this.generation) return
        this.push("sent", wire ? wire.data : "", wire ? wire.encoding : "utf8")
      } catch (error) {
        this.logError(error)
      }
    },
    formatResponse(status, headers, data) {
      const head = `${this.$t("status")}: ${status}\n${this.$t("headers")}: ${JSON.stringify(
        headers || {},
        null,
        2
      )}`
      const body =
        typeof data === "string" ? data : data == null ? "" : JSON.stringify(data, null, 2)
      return body ? `${head}\n\n${body}` : head
    },
    async sendHttpRequest(generation) {
      let wire
      try {
        wire = this.protocol.payload === "none" ? null : editorToWire(this.payload)
      } catch (error) {
        return this.logError(error)
      }
      let request
      try {
        request = this.protocol.buildRequest(this.fields, wire)
      } catch (error) {
        return this.logError(error)
      }
      this.busy = true
      try {
        const { status, headers, data } = await sendHttp(request, this.$store)
        if (generation !== this.generation) return
        this.push("received", this.formatResponse(status, headers, data))
      } catch (error) {
        if (generation === this.generation) this.logError(error)
      } finally {
        if (generation === this.generation) this.busy = false
      }
    },
  },
}
</script>
