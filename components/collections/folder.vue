<template>
  <div>
    <div class="flex-wrap">
      <div>
        <button class="icon" @click="toggleShowChildren">
          <pw-icon v-show="!showChildren" name="chevron-right" />
          <pw-icon v-show="showChildren" name="chevron-down" />
          <pw-icon name="folder-open" />
          <span>{{ folder.name }}</span>
        </button>
      </div>
      <v-popover>
        <button class="tooltip-target icon" v-tooltip="$t('more')">
          <pw-icon name="more" />
        </button>
        <template slot="popover">
          <div>
            <button class="icon" @click="editFolder" v-close-popover>
              <pw-icon name="edit" />
              <span>{{ $t("edit") }}</span>
            </button>
          </div>
          <div>
            <button class="icon" @click="removeFolder" v-close-popover>
              <pw-icon name="delete" />
              <span>{{ $t("delete") }}</span>
            </button>
          </div>
        </template>
      </v-popover>
    </div>

    <div v-show="showChildren">
      <ul>
        <li v-for="(request, index) in folder.requests" :key="index">
          <request
            :request="request"
            :collection-index="collectionIndex"
            :folder-index="folderIndex"
            :request-index="index"
            @edit-request="
              $emit('edit-request', {
                request,
                collectionIndex,
                folderIndex,
                requestIndex: index,
              })
            "
          />
        </li>
        <li v-if="folder.requests.length === 0">
          <label>{{ $t("folder_empty") }}</label>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped lang="scss">
ul {
  display: flex;
  flex-direction: column;
  margin: 0;
}

ul li {
  display: flex;
  margin-left: 18px;
  padding-left: 6px;
  border-left: 1px solid var(--brd-color);
}
</style>

<script>
export default {
  props: {
    folder: Object,
    collectionIndex: Number,
    folderIndex: Number,
  },
  components: {
    request: () => import("./request"),
  },
  data() {
    return {
      showChildren: false,
    }
  },
  methods: {
    toggleShowChildren() {
      this.showChildren = !this.showChildren
    },
    selectRequest(request) {
      this.$store.commit("postwoman/selectRequest", { request })
    },
    removeFolder() {
      if (!confirm("Are you sure you want to remove this folder?")) return
      this.$store.commit("postwoman/removeFolder", {
        collectionIndex: this.collectionIndex,
        folderIndex: this.folderIndex,
      })
    },
    editFolder() {
      this.$emit("edit-folder")
    },
  },
}
</script>
