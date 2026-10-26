<template>
  <div class="protocol-log">
    <div class="log-toolbar">
      <button class="icon" :class="{ primary: !hexView }" @click="hexView = false">
        <pw-icon name="notes" />
        <span>{{ $t("text") }}</span>
      </button>
      <button class="icon" :class="{ primary: hexView }" @click="hexView = true">
        <pw-icon name="code" />
        <span>{{ $t("hex") }}</span>
      </button>
      <button class="icon" @click="$emit('clear')">
        <pw-icon name="clear_all" />
        <span>{{ $t("clear_log") }}</span>
      </button>
    </div>
    <div class="log-entries" ref="entries">
      <div v-if="!entries.length" class="log-empty">{{ $t("no_output_yet") }}</div>
      <div
        v-for="(row, index) in rows"
        :key="index"
        class="log-entry"
        :class="'direction-' + row.entry.direction"
      >
        <span class="log-meta">@ {{ formatTime(row.entry.ts) }} {{ row.entry.direction }}</span>
        <span v-if="row.entry.remote" class="log-remote"
          >{{ $t("from") }} {{ row.entry.remote }}</span
        >
        <span v-if="row.binary" class="log-binary">{{ $t("binary") }}</span>
        <span class="log-data">{{ row.display }}</span>
        <span v-if="row.entry.truncated" class="log-truncated">
          … {{ row.entry.bytes }} {{ $t("bytes") }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
div.protocol-log {
  width: 100%;
}

div.log-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
  margin-bottom: 6px;
}

div.log-entries {
  padding: 10px 12px;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius-sm);
  background-color: var(--bg-color);
  color: var(--fg-color);
  height: 240px;
  overflow: auto;
  font-size: 12.5px;
  font-family: var(--font-mono);
  font-weight: 400;
  line-height: 1.55;
}

.log-empty {
  color: var(--fg-light-color);
  font-family: var(--font-sans);
  font-size: 12.5px;
}

.log-entry {
  display: block;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
}

.log-meta {
  margin-right: 8px;
}

.direction-sent .log-meta {
  color: var(--ac-color);
}

.direction-received .log-meta {
  color: var(--fg-light-color);
}

.direction-info .log-meta {
  color: var(--fg-light-color);
}

.direction-error .log-meta {
  color: #ff5555;
}

.log-remote {
  margin-right: 8px;
  color: var(--fg-light-color);
}

.log-binary,
.log-truncated {
  display: block;
  color: var(--fg-light-color);
}
</style>

<script>
import {
  base64ToBytes,
  bytesToUtf8,
  hasUnprintable,
  toHexDump,
  utf8ToBytes,
} from "~/functions/bytes.mjs"

export default {
  props: {
    entries: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      hexView: false,
    }
  },
  computed: {
    rows() {
      return this.entries.slice(-2000).map(entry => {
        const bytes = this.toBytes(entry)
        if (!bytes) return { entry, display: this.raw(entry), binary: false }
        if (this.hexView) return { entry, display: toHexDump(bytes), binary: false }
        if (entry.encoding === "base64") {
          const text = bytesToUtf8(bytes)
          if (hasUnprintable(text)) return { entry, display: toHexDump(bytes), binary: true }
          return { entry, display: text, binary: false }
        }
        return { entry, display: this.raw(entry), binary: false }
      })
    },
  },
  mounted() {
    this.scrollToBottom()
  },
  updated() {
    this.scrollToBottom()
  },
  methods: {
    raw(entry) {
      return entry.data == null ? "" : String(entry.data)
    },
    toBytes(entry) {
      try {
        if (entry.encoding === "base64") return base64ToBytes(entry.data || "")
        return utf8ToBytes(entry.data == null ? "" : String(entry.data))
      } catch {
        return null
      }
    },
    formatTime(ts) {
      if (typeof ts === "number" || ts instanceof Date) return new Date(ts).toLocaleTimeString()
      return ts || ""
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const entries = this.$refs.entries
        if (entries) entries.scrollTop = entries.scrollHeight
      })
    },
  },
}
</script>
