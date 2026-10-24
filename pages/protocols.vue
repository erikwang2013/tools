<template>
  <div class="page">
    <pw-section class="green" :label="$t('protocol_lab')">
      <div class="agent-bar">
        <span class="agent-state" :class="agentStatus">
          <i class="material-icons">lan</i>
          Agent: {{ $t(agentStatus) }}
        </span>
        <span v-if="!agentConnected" class="agent-hint">
          {{ $t("agent_offline_hint") }}
          {{ $t("start_agent_command") }}
          <code>npm run agent</code>.
          <nuxt-link class="agent-settings" :to="localePath('settings')">
            {{ $t("settings") }}
          </nuxt-link>
        </span>
      </div>

      <div class="protocol-columns">
        <aside class="protocol-list">
          <div v-for="group in groups" :key="group.title" class="protocol-group">
            <h4>{{ group.title }}</h4>
            <button
              v-for="protocol in group.protocols"
              :key="protocol.id"
              class="protocol-button"
              :class="{ active: protocol.id === selected.id }"
              :aria-pressed="protocol.id === selected.id"
              @click="selected = protocol"
            >
              {{ protocol.label }}
            </button>
          </div>
        </aside>

        <div class="protocol-detail">
          <lab :protocol="selected" />
        </div>
      </div>
    </pw-section>
  </div>
</template>

<style scoped lang="scss">
.agent-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 8px;
}

.agent-state {
  display: inline-flex;
  align-items: center;
  color: var(--fg-light-color);

  i {
    margin-right: 8px;
  }

  &.connected {
    color: #50fa7b;
  }

  &.error {
    color: var(--err-color);
  }
}

.agent-hint {
  margin-left: 16px;
  color: var(--fg-light-color);
  font-size: 14px;

  code {
    margin: 0 4px;
    font-size: 14px;
  }
}

.agent-settings {
  color: var(--ac-color);
}

.protocol-columns {
  display: flex;
  align-items: flex-start;
  padding: 0 8px 8px;
}

.protocol-list {
  flex: 0 0 176px;
  margin-right: 12px;
}

.protocol-group h4 {
  margin: 8px 4px 4px;
  color: var(--fg-light-color);
  font-size: 12px;
  text-transform: uppercase;
}

.protocol-button {
  justify-content: flex-start;
  width: 100%;
  margin: 2px 0;
  padding: 8px 12px;
  border-radius: 8px;
  background-color: transparent;
  color: var(--fg-color);
  font-size: 14px;
  font-weight: 500;

  &:not([disabled]):hover,
  &:not([disabled]):focus {
    background-color: var(--bg-light-color);
    color: var(--fg-color);
    box-shadow: none;
  }

  &.active {
    background-color: var(--ac-color);
    color: var(--act-color);
  }
}

.protocol-detail {
  flex: 1;
  min-width: 0;
}

@media (max-width: 768px) {
  .protocol-columns {
    flex-flow: column;
  }

  .protocol-list {
    flex: 1 1 auto;
    width: 100%;
    margin-right: 0;
  }
}
</style>

<script>
import { agentClient } from "~/functions/agent-client.mjs"
import { GROUPS, protocols } from "~/protocols/registry.mjs"

export default {
  components: {
    "pw-section": () => import("../components/layout/section"),
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
  },
}
</script>
