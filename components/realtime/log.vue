<template>
  <div>
    <label for="log">{{ title }}</label>
    <div name="log" class="realtime-log" ref="log">
      <span v-if="log">
        <span v-for="(logEntry, index) in log" :style="{ color: logEntry.color }" :key="index"
          >@ {{ logEntry.ts }}{{ getSourcePrefix(logEntry.source) }}{{ logEntry.payload }}</span
        >
      </span>
      <span v-else>{{ $t("waiting_for_connection") }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
div.realtime-log {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius-sm);
  background-color: var(--bg-color);
  color: var(--fg-color);
  height: 240px;
  overflow: auto;
  font-family: var(--font-mono);

  &,
  span {
    font-size: 12.5px;
    line-height: 1.55;
  }

  span {
    display: block;
    white-space: pre-wrap;
    word-wrap: break-word;
    word-break: break-all;
  }
}
</style>

<script>
import { getSourcePrefix } from "~/functions/utils/string"

export default {
  props: ["log", "title"],
  methods: {
    getSourcePrefix,
  },
  updated: function() {
    this.$nextTick(function() {
      if (this.$refs.log) {
        this.$refs.log.scrollBy(0, this.$refs.log.scrollHeight + 100)
      }
    })
  },
}
</script>
