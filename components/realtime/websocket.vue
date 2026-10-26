<template>
  <div class="realtime-panel">
    <pw-section class="blue" :label="$t('request')" ref="request">
      <ul>
        <li>
          <label for="websocket-url">{{ $t("url") }}</label>
          <input
            id="websocket-url"
            type="url"
            spellcheck="false"
            :class="{ error: !urlValid }"
            v-model="url"
            @keyup.enter="urlValid ? toggleConnection() : null"
          />
        </li>
        <div>
          <li>
            <label for="connect" class="hide-on-small-screen">&nbsp;</label>
            <button
              :class="{ secondary: connectionState }"
              :disabled="!urlValid"
              id="connect"
              name="connect"
              @click="toggleConnection"
            >
              {{ !connectionState ? $t("connect") : $t("disconnect") }}
              <span>
                <pw-icon :name="!connectionState ? 'sync' : 'sync-disabled'" />
              </span>
            </button>
          </li>
        </div>
      </ul>
    </pw-section>

    <pw-section class="purple" :label="$t('communication')" id="response" ref="response">
      <ul>
        <li>
          <realtime-log :title="$t('log')" :log="communication.log" />
        </li>
      </ul>
      <ul>
        <li>
          <label for="websocket-mode">{{ $t("payload") }}</label>
          <select id="websocket-mode" v-model="binaryMode" :disabled="connectionState">
            <option :value="false">{{ $t("text") }}</option>
            <option :value="true">{{ $t("binary") }}</option>
          </select>
        </li>
        <li>
          <label for="websocket-message">{{ $t("message") }}</label>
          <input
            id="websocket-message"
            name="message"
            type="text"
            v-model="communication.input"
            :readonly="!connectionState"
            :placeholder="binaryMode ? 'Hex bytes, e.g. 68656c6c6f' : ''"
            @keyup.enter="connectionState ? sendMessage() : null"
          />
        </li>
        <div>
          <li>
            <label for="send" class="hide-on-small-screen">&nbsp;</label>
            <button id="send" name="send" :disabled="!connectionState" @click="sendMessage">
              {{ $t("send") }}
              <span>
                <pw-icon name="send" />
              </span>
            </button>
          </li>
        </div>
      </ul>
    </pw-section>
  </div>
</template>

<script>
import { hexToBytes, isHex, toHexDump } from "~/functions/bytes.mjs"
import { wsValid } from "~/functions/utils/valid"

export default {
  components: {
    "pw-section": () => import("../layout/section"),
    realtimeLog: () => import("./log"),
  },
  data() {
    return {
      connectionState: false,
      connecting: false,
      binaryMode: false,
      url: "wss://echo.websocket.org",
      socket: null,
      communication: {
        log: null,
        input: "",
      },
    }
  },
  computed: {
    urlValid() {
      return wsValid(this.url)
    },
  },
  methods: {
    toggleConnection() {
      // If it is connecting:
      if (!this.connectionState) return this.connect()
      // Otherwise, it's disconnecting.
      else return this.disconnect()
    },
    connect() {
      if (this.connecting || this.connectionState) return
      this.connecting = true
      this.communication.log = [
        {
          payload: this.$t("connecting_to", { name: this.url }),
          source: "info",
          color: "var(--ac-color)",
        },
      ]
      try {
        this.socket = new WebSocket(this.url)
        this.socket.binaryType = "arraybuffer"
        this.socket.onopen = event => {
          this.connecting = false
          this.connectionState = true
          this.communication.log = [
            {
              payload: this.$t("connected_to", { name: this.url }),
              source: "info",
              color: "var(--ac-color)",
              ts: new Date().toLocaleTimeString(),
            },
          ]
          this.$toast.success(this.$t("connected"), {})
        }
        this.socket.onerror = event => {
          this.handleError()
        }
        this.socket.onclose = event => {
          this.connecting = false
          this.connectionState = false
          this.communication.log.push({
            payload: this.$t("disconnected_from", { name: this.url }),
            source: "info",
            color: "#dc2626",
            ts: new Date().toLocaleTimeString(),
          })
          this.$toast.error(this.$t("disconnected"), {})
        }
        this.socket.onmessage = event => {
          this.communication.log.push({
            payload:
              event.data instanceof ArrayBuffer
                ? toHexDump(new Uint8Array(event.data))
                : event.data,
            source: "server",
            ts: new Date().toLocaleTimeString(),
          })
        }
      } catch (ex) {
        this.connecting = false
        this.handleError(ex)
        this.$toast.error(this.$t("something_went_wrong"), {})
      }
    },
    disconnect() {
      this.connecting = false
      if (this.socket) this.socket.close()
    },
    handleError(error) {
      this.disconnect()
      this.connectionState = false
      this.communication.log.push({
        payload: this.$t("error_occurred"),
        source: "info",
        color: "#dc2626",
        ts: new Date().toLocaleTimeString(),
      })
      if (error !== null)
        this.communication.log.push({
          payload: error,
          source: "info",
          color: "#dc2626",
          ts: new Date().toLocaleTimeString(),
        })
    },
    sendMessage() {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
      const message = this.communication.input
      let payload = message
      if (this.binaryMode) {
        if (!isHex(message)) {
          this.$toast.error(this.$t("invalid_hex"), {})
          return
        }
        const bytes = hexToBytes(message)
        payload = toHexDump(bytes)
        this.socket.send(bytes.buffer)
      } else {
        this.socket.send(message)
      }
      this.communication.log.push({
        payload,
        source: "client",
        ts: new Date().toLocaleTimeString(),
      })
      this.communication.input = ""
    },
  },
  beforeDestroy() {
    if (this.socket) this.socket.close()
  },
}
</script>
