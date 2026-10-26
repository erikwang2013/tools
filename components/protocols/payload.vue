<template>
  <ul>
    <li>
      <label for="payload-mode">{{ label || $t("payload") }}</label>
      <select id="payload-mode" :value="mode" @change="setMode($event.target.value)">
        <option v-for="item in modes" :key="item" :value="item">{{ $t(item) }}</option>
      </select>
    </li>
    <li v-if="mode === 'file'">
      <label for="payload-file">{{ $t("file") }}</label>
      <div>
        <button class="icon" @click="$refs.file.click()">
          <pw-icon name="folder-open" />
          <span>{{ $t("choose_file") }}</span>
        </button>
        <span v-if="filename" class="payload-meta">{{ filename }}</span>
      </div>
      <input id="payload-file" ref="file" type="file" @change="readFile" />
      <span v-if="error" class="payload-error">{{ error }}</span>
    </li>
    <li v-else>
      <label for="payload-data">{{ $t(mode) }}</label>
      <textarea
        id="payload-data"
        :value="mode === 'base64' ? base64 : text"
        spellcheck="false"
        rows="5"
        @input="onInput"
      ></textarea>
      <span v-if="error" class="payload-error">{{ error }}</span>
      <span v-else-if="mode === 'hex'" class="payload-meta">
        {{ text.length / 2 }} {{ $t("bytes") }}
      </span>
    </li>
  </ul>
</template>

<style scoped lang="scss">
.payload-meta {
  padding: 4px;
  color: var(--fg-light-color);
  font-size: 14px;
}

.payload-error {
  padding: 4px;
  color: #ff5555;
  font-size: 14px;
}
</style>

<script>
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  hexToBytes,
  isBase64,
  isHex,
  utf8ToBytes,
} from "~/functions/bytes.mjs"
import { MAX_PAYLOAD_BYTES } from "~/functions/payload.mjs"

function base64ByteLength(value) {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0
  return (value.length / 4) * 3 - padding
}

export default {
  props: {
    value: {
      type: Object,
      default: () => ({}),
    },
    modes: {
      type: Array,
      default: () => ["text"],
    },
    label: {
      type: String,
      default: "",
    },
  },
  data() {
    const value = this.value || {}
    return {
      mode: value.mode || this.modes[0] || "text",
      text: value.text || "",
      base64: value.base64 || "",
      filename: value.filename || "",
      error: "",
    }
  },
  watch: {
    value: {
      deep: true,
      handler(value) {
        if (!value) return
        this.mode = value.mode || this.mode
        this.text = value.text || ""
        this.base64 = value.base64 || ""
        this.filename = value.filename || ""
        this.error = ""
      },
    },
  },
  methods: {
    emit() {
      this.$emit("input", {
        mode: this.mode,
        text: this.text,
        base64: this.base64,
        filename: this.filename,
      })
    },
    fail(key) {
      this.error = this.$t(key)
    },
    commit() {
      if (this.mode === "hex") {
        if (!isHex(this.text)) return this.fail("invalid_hex")
        if (this.text.length / 2 > MAX_PAYLOAD_BYTES) return this.fail("payload_too_large")
        this.base64 = bytesToBase64(hexToBytes(this.text))
      } else if (this.mode === "base64") {
        if (!isBase64(this.base64)) return this.fail("invalid_base64")
        if (base64ByteLength(this.base64) > MAX_PAYLOAD_BYTES) {
          return this.fail("payload_too_large")
        }
        this.text = bytesToHex(base64ToBytes(this.base64))
      } else if (this.mode === "file") {
        if (!isBase64(this.base64)) return this.fail("invalid_base64")
        if (base64ByteLength(this.base64) > MAX_PAYLOAD_BYTES) {
          return this.fail("payload_too_large")
        }
      } else if (utf8ToBytes(this.text).length > MAX_PAYLOAD_BYTES) {
        return this.fail("payload_too_large")
      }
      this.error = ""
      this.emit()
    },
    onInput({ target }) {
      if (this.mode === "base64") this.base64 = target.value
      else this.text = target.value
      this.commit()
    },
    setMode(mode) {
      // Carry the other representation over when switching inside binary modes.
      if (mode === "hex" && ["base64", "file"].includes(this.mode) && isBase64(this.base64)) {
        this.text = bytesToHex(base64ToBytes(this.base64))
      } else if (mode === "base64" && this.mode === "hex" && isHex(this.text)) {
        this.base64 = bytesToBase64(hexToBytes(this.text))
      }
      this.mode = mode
      this.commit()
    },
    readFile({ target }) {
      const file = target.files && target.files[0]
      if (!file) return
      this.error = ""
      if (file.size > MAX_PAYLOAD_BYTES) return this.fail("payload_too_large")
      const reader = new FileReader()
      reader.onload = ({ target: result }) => {
        this.filename = file.name
        this.base64 = String(result.result).replace(/^data:.*;base64,/, "")
        this.commit()
      }
      reader.onerror = () => this.fail("something_went_wrong")
      reader.readAsDataURL(file)
    },
  },
}
</script>
