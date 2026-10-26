<template>
  <button
    type="button"
    class="color"
    :data-color="color"
    :class="{ active: active }"
    :aria-label="name || color"
    :aria-pressed="active"
    v-tooltip="{ content: name || color }"
    :style="{ backgroundColor: color }"
  >
    <pw-icon v-if="active" name="done" class="activeTick" />
  </button>
</template>

<style scoped lang="scss">
.color {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin: 0;
  padding: 0;
  border: 2px solid var(--bg-dark-color);
  border-radius: 50%;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover,
  &:focus-visible {
    border-color: var(--fg-light-color);
    outline: 0;
  }

  &.active {
    border-color: var(--ac-color);
    box-shadow: 0 0 0 3px var(--ac-soft);
  }

  .activeTick {
    width: 14px;
    height: 14px;
    color: #ffffff;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
  }
}
</style>

<script>
export default {
  props: {
    color: {
      type: String,
      required: true,
    },
    name: {
      type: String,
    },
    active: {
      type: Boolean,
      default: false,
    },
  },
}
</script>
