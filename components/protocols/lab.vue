<template>
  <div class="protocol-lab">
    <div class="lab-header">
      <strong class="lab-title">{{ protocol.label }}</strong>
      <span class="lab-transport">{{ transportLabel }}</span>
      <span v-if="isAgent" class="lab-status">{{ $t(agentStatus) }}</span>
    </div>

    <ul class="lab-fields">
      <li
        v-for="field in protocol.fields"
        :key="field.key"
        :class="{ 'lab-field-wide': ['keyvalue', 'textarea'].includes(field.type) }"
      >
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
              <pw-icon name="remove" />
            </button>
          </div>
          <button class="icon" @click="addKeyvalue(field)">
            <pw-icon name="add" />
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

    <component
      v-if="panelComponent"
      :is="panelComponent"
      :protocol="protocol"
      :fields="fields"
      :payload="payload"
      @log="onPanelLog"
    />
    <p v-else-if="protocol.transport === 'browser'" class="lab-hint">
      {{ $t("panel_not_implemented") }}
    </p>

    <div class="lab-actions">
      <button
        v-if="protocol.transport === 'agent' && hasAction('connect')"
        class="secondary"
        :disabled="!canConnect"
        @click="connect"
      >
        <pw-icon name="sync" />
        <span>{{ $t("connect") }}</span>
      </button>
      <button
        v-if="protocol.transport !== 'browser' && hasAction('send')"
        :disabled="!canSend"
        @click="send"
      >
        <pw-icon name="send" />
        <span>{{ $t("send") }}</span>
      </button>
      <button
        v-if="protocol.transport === 'agent' && hasAction('close')"
        class="secondary"
        :disabled="!sessionId"
        @click="close"
      >
        <pw-icon name="sync-disabled" />
        <span>{{ $t("close") }}</span>
      </button>
      <button v-if="canRetryViaAgent" class="secondary" @click="retryViaAgent">
        <pw-icon name="sync" />
        <span>{{ $t("retry_via_agent") }}</span>
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
  padding: 18px;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius);
  background-color: var(--bg-light-color);
  box-shadow: var(--shadow-sm);
}

div.lab-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--brd-color);
}

.lab-title {
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.lab-transport,
.lab-status {
  padding: 3px 7px;
  border-radius: 5px;
  background-color: var(--bg-dark-color);
  color: var(--fg-light-color);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
}

.lab-status {
  margin-left: auto;
}

ul.lab-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 14px;
}

ul.lab-fields > li {
  display: flex;
  flex-flow: column nowrap;
  min-width: 0;
}

ul.lab-fields > li.lab-field-wide {
  grid-column: 1 / -1;
}

.lab-kv-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;

  input {
    min-width: 0;
  }
}

div.lab-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 4px 0 10px;

  button {
    margin: 0;
  }
}

p.lab-hint {
  margin: 8px 0 12px;
  padding: 9px 10px;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius-sm);
  background-color: var(--bg-color);
  color: var(--fg-light-color);
  font-size: 12.5px;

  code {
    color: var(--fg-color);
    font-family: var(--font-mono);
  }
}

@media (max-width: 768px) {
  div.protocol-lab {
    padding: 14px;
  }

  ul.lab-fields {
    grid-template-columns: 1fr;
  }
}
</style>

<script>
import { agentClient } from "~/functions/agent-client.mjs"
import { bytesToBase64 } from "~/functions/bytes.mjs"
import { describeBinaryResponse } from "~/functions/http-normalize.mjs"
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
const PANELS = {
  a2a: () => import("./panels/a2a.vue"),
  hls: () => import("./panels/hls.vue"),
  mcp: () => import("./panels/mcp.vue"),
  sip: () => import("./panels/sip.vue"),
  stomp: () => import("./panels/stomp.vue"),
  webhooks: () => import("./panels/webhooks.vue"),
  webrtc: () => import("./panels/webrtc.vue"),
  xmpp: () => import("./panels/xmpp.vue"),
}

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
      lastFailedRequest: null,
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
    canRetryViaAgent() {
      return Boolean(this.protocol.agentFallback && this.agentConnected && this.lastFailedRequest && !this.busy)
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
          // Optional numeric fields start empty so builders can omit them; fields
          // that need 0 declare default: 0 explicitly.
          fields[field.key] = ""
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
      this.lastFailedRequest = null
      this.initFields()
      this.initPayload()
      this.entries = []
    },
    onPanelLog(event) {
      if (!event) return
      if (event.message !== undefined) this.push(event.direction || "info", event.message)
      else this.push(event.direction || "received", event.data, event.encoding, { bytes: event.bytes })
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
      this.lastFailedRequest = null
      try {
        const { status, headers, data } = await sendHttp(request, this.$store)
        if (generation !== this.generation) return
        if (request.responseType === "arraybuffer") {
          const settings = this.$store.state.postwoman.settings
          const check = describeBinaryResponse(data, {
            responseType: "arraybuffer",
            viaProxy:
              Boolean(settings.PROXY_ENABLED) ||
              typeof window.__POSTWOMAN_EXTENSION_HOOK__ !== "undefined",
          })
          if (!check.ok) return this.push("error", check.message)
          const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data
          this.push("info", this.formatResponse(status, headers, ""))
          this.push("received", bytesToBase64(bytes), "base64", { bytes: bytes.length })
          return
        }
        this.push("received", this.formatResponse(status, headers, data))
      } catch (error) {
        if (generation === this.generation) {
          if (this.protocol.agentFallback && this.agentConnected) this.lastFailedRequest = request
          this.logError(error)
        }
      } finally {
        if (generation === this.generation) this.busy = false
      }
    },
    async retryViaAgent() {
      const request = this.lastFailedRequest
      if (!request || !this.canRetryViaAgent) return
      this.busy = true
      try {
        const { sessionId, payload } = await agentClient.open("http-proxy", {
          url: request.url,
          method: request.method,
          headers: request.headers,
        })
        this.sessionId = sessionId
        this.lastFailedRequest = null
        this.push("info", `${this.$t("via_agent")} ${JSON.stringify(payload || {})}`)
        let wire = null
        if (request.data instanceof Uint8Array) {
          wire = { encoding: "base64", data: bytesToBase64(request.data) }
        } else if (typeof request.data === "string") {
          wire = { encoding: "utf8", data: request.data }
        }
        await agentClient.send(sessionId, wire)
      } catch (error) {
        this.logError(error)
      } finally {
        this.busy = false
      }
    },
  },
}
</script>
