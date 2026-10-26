<template>
  <div class="flex-wrap">
    <div>
      <button class="icon" @click="selectRequest()" v-tooltip="$t('use_request')">
        <pw-icon name="insert-drive-file" />
        <span>{{ request.name }}</span>
      </button>
    </div>
    <v-popover>
      <button class="tooltip-target icon" v-tooltip="$t('more')">
        <pw-icon name="more" />
      </button>
      <template slot="popover">
        <div>
          <button class="icon" @click="$emit('edit-request')" v-close-popover>
            <pw-icon name="edit" />
            <span>{{ $t("edit") }}</span>
          </button>
        </div>
        <div>
          <button class="icon" @click="removeRequest" v-close-popover>
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
    request: Object,
    collectionIndex: Number,
    folderIndex: Number,
    requestIndex: Number,
  },
  methods: {
    selectRequest() {
      this.$store.commit("postwoman/selectRequest", { request: this.request })
    },
    removeRequest() {
      if (!confirm("Are you sure you want to remove this request?")) return
      this.$store.commit("postwoman/removeRequest", {
        collectionIndex: this.collectionIndex,
        folderIndex: this.folderIndex,
        requestIndex: this.requestIndex,
      })
    },
  },
}
</script>
