<template>
  <div class="flex-wrap">
    <div>
      <button class="icon" @click="$emit('select-environment')" v-tooltip="$t('use_environment')">
        <pw-icon name="insert-drive-file" />
        <span>{{ environment.name }}</span>
      </button>
    </div>
    <v-popover>
      <button class="tooltip-target icon" v-tooltip="$t('more')">
        <pw-icon name="more" />
      </button>
      <template slot="popover">
        <div>
          <button class="icon" @click="$emit('edit-environment')" v-close-popover>
            <pw-icon name="create" />
            <span>{{ $t("edit") }}</span>
          </button>
        </div>
        <div>
          <button class="icon" @click="removeEnvironment" v-close-popover>
            <pw-icon name="delete" />
            <span>{{ $t("delete") }}</span>
          </button>
        </div>
      </template>
    </v-popover>
  </div>
</template>

<style scoped lang="scss">
.flex-wrap {
  gap: 2px;
}

button.icon {
  justify-content: flex-start;
  max-width: 100%;
  padding: 0 6px;
  color: var(--fg-color);
  font-size: 12.5px;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>

<script>
export default {
  props: {
    environment: Object,
    environmentIndex: Number,
  },
  methods: {
    removeEnvironment() {
      if (!confirm("Are you sure you want to remove this environment?")) return
      this.$store.commit("postwoman/removeEnvironment", this.environmentIndex)
    },
  },
}
</script>
