<template>
  <div class="tabs-wrapper">
    <div class="tabs">
      <ul>
        <li v-for="tab in tabs" :class="{ 'is-active': tab.isActive }">
          <a :href="tab.href" @click="selectTab(tab)">
            <pw-icon v-if="tab.icon" :name="normalizeIcon(tab.icon)" />
            <span v-if="tab.label">{{ tab.label }}</span>
          </a>
        </li>
      </ul>
    </div>
    <div class="tabs-details">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tabs-wrapper {
  display: flex;
  flex-flow: column nowrap;
  flex-grow: 1;
}

.tabs {
  display: flex;
  align-items: center;
  align-self: flex-start;
  max-width: 100%;
  padding: 3px;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius-sm);
  background: var(--bg-light-color);
  overflow-x: auto;
}

.tabs ul {
  display: flex;
  flex-flow: row nowrap;
  width: auto;
  margin: 0;
  gap: 2px;
}

.tabs li {
  display: flex;
}

.tabs a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  padding: 0 11px;
  gap: 6px;
  border-radius: 6px;
  color: var(--fg-light-color);
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.tabs a:hover {
  background: var(--bg-dark-color);
  color: var(--fg-color);
}

.tabs li.is-active a {
  background: var(--ac-soft);
  color: var(--ac-color);
  font-weight: 600;
}

.tabs-details {
  margin-top: 12px;
}

@media (max-width: 768px) {
  .tabs {
    width: 100%;
  }
}
</style>

<script>
export default {
  data() {
    return {
      tabs: [],
    }
  },

  mounted() {
    this.tabs = this.$children.filter(
      child => child.$options.props && ("label" in child.$options.props || "icon" in child.$options.props)
    )
  },

  methods: {
    normalizeIcon(name) {
      return String(name).replace(/_/g, "-")
    },
    selectTab({ id }) {
      this.tabs.forEach(tab => {
        tab.isActive = tab.id == id
      })
    },
  },
}
</script>
