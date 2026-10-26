<template>
  <div class="page protocols-page">
    <div class="agent-bar">
      <span class="agent-state" :class="agentStatus">
        <span class="status-dot" />
        <pw-icon name="dns" />
        Agent: {{ $t(agentStatus) }}
      </span>
      <span v-if="!agentConnected" class="agent-hint">
        <span>{{ $t("agent_offline_hint") }}</span>
        <span class="agent-start">
          {{ $t("start_agent_command") }}
          <code>npm run agent</code>.
          <nuxt-link class="agent-settings" :to="localePath('settings')">
            {{ $t("settings") }}
          </nuxt-link>
        </span>
      </span>
    </div>

    <div class="protocol-columns">
      <aside class="protocol-list">
        <div v-for="group in groups" :key="group.title" class="protocol-group">
          <h4>
            <pw-icon :name="group.icon" />
            {{ group.title }}
          </h4>
          <button
            v-for="protocol in group.protocols"
            :key="protocol.id"
            type="button"
            class="protocol-button"
            :class="{ active: protocol.id === selected.id }"
            :aria-pressed="protocol.id === selected.id"
            @click="selectProtocol(protocol)"
          >
            <span class="protocol-glyph" aria-hidden="true">{{ protocolGlyph(protocol) }}</span>
            <span class="protocol-name">{{ protocol.label }}</span>
          </button>
        </div>
      </aside>

      <div ref="detail" class="protocol-detail">
        <lab :protocol="selected" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.protocols-page {
  max-width: 1600px;
}

.agent-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 9px 12px;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius-sm);
  background-color: var(--bg-light-color);
  font-size: 12.5px;
}

.agent-state {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--fg-light-color);

  .pw-icon {
    color: var(--fg-light-color);
  }

  &.connected {
    color: var(--success-color);
  }

  &.connected .status-dot {
    background-color: var(--success-color);
  }

  &.error {
    color: #dc2626;
  }

  &.error .status-dot {
    background-color: #dc2626;
  }
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--fg-light-color);
}

.agent-hint {
  flex: 1 1 100%;
  line-height: 1.6;
  color: var(--fg-light-color);

  code {
    white-space: nowrap;
    margin: 0 4px;
    color: var(--fg-color);
    font-family: var(--font-mono);
    font-size: 12px;
  }
}

.agent-start {
  display: block;
  margin-top: 3px;
}

.agent-settings {
  color: var(--ac-color);
  font-weight: 500;
}

.protocol-columns {
  display: grid;
  grid-template-columns: 244px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.protocol-list {
  position: sticky;
  top: calc(var(--topbar-height) + 16px);
  max-height: calc(100vh - var(--topbar-height) - 40px);
  overflow-y: auto;
  padding-right: 4px;
}

.protocol-group {
  margin-bottom: 14px;
}

.protocol-group h4 {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 5px;
  padding: 0 8px;
  color: var(--fg-light-color);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;

  .pw-icon {
    width: 14px;
    height: 14px;
  }
}

.protocol-button {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 36px;
  margin: 1px 0;
  padding: 0 8px;
  gap: 9px;
  border-radius: 8px;
  background-color: transparent;
  color: var(--fg-color);
  font-size: 13px;
  font-weight: 450;
  text-align: left;
  transition: background-color 0.15s ease, color 0.15s ease;

  &:not([disabled]):hover,
  &:not([disabled]):focus {
    background-color: var(--bg-dark-color);
    color: var(--fg-color);
    box-shadow: none;
    filter: none;
  }

  &.active {
    background-color: var(--ac-soft);
    color: var(--ac-color);
    font-weight: 600;
  }
}

.protocol-glyph {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background-color: var(--bg-dark-color);
  color: var(--fg-light-color);
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.protocol-button.active .protocol-glyph {
  background-color: var(--ac-color);
  color: var(--act-color);
}

.protocol-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.protocol-detail {
  min-width: 0;
  scroll-margin-top: 12px;
}

@media (max-width: 900px) {
  .protocol-columns {
    grid-template-columns: 1fr;
  }

  .protocol-list {
    position: static;
    max-height: none;
    overflow: visible;
    padding-right: 0;
  }
}
</style>

<script>
import { agentClient } from "~/functions/agent-client.mjs"
import { GROUPS, GROUP_ICONS, protocols } from "~/protocols/registry.mjs"

export default {
  components: {
    lab: () => import("../components/protocols/lab"),
  },

  data() {
    return {
      agentStatus: agentClient.status,
      selected: protocols[0],
    }
  },

  computed: {
    agentConnected() {
      return this.agentStatus === "connected"
    },
    groups() {
      return GROUPS.map(title => ({
        title,
        icon: GROUP_ICONS[title],
        protocols: protocols.filter(protocol => protocol.group === title),
      })).filter(group => group.protocols.length)
    },
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
    protocolGlyph(protocol) {
      const words = protocol.label
        .replace(/[()/]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
      if (words.length > 1) {
        return words
          .map(word => word[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      }
      return protocol.label.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase()
    },
    selectProtocol(protocol) {
      this.selected = protocol
      if (typeof window === "undefined" || !window.matchMedia("(max-width: 900px)").matches) return
      this.$nextTick(() => {
        const detail = this.$refs.detail
        if (!detail) return
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        detail.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
      })
    },
  },
}
</script>
