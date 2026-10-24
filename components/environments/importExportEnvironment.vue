<template>
  <modal v-if="show" @close="hideModal">
    <div slot="header">
      <ul>
        <li>
          <div class="flex-wrap">
            <h3 class="title">{{ $t("import_export") }} {{ $t("environments") }}</h3>
            <div>
              <button class="icon" @click="hideModal">
                <i class="material-icons">close</i>
              </button>
            </div>
          </div>
          <div class="flex-wrap">
            <button
              class="icon"
              @click="openDialogChooseFileToReplaceWith"
              v-tooltip="$t('replace_current')"
            >
              <i class="material-icons">create_new_folder</i>
              <span>{{ $t("replace_json") }}</span>
              <input
                type="file"
                @change="replaceWithJSON"
                style="display: none;"
                ref="inputChooseFileToReplaceWith"
                accept="application/json"
              />
            </button>
            <button
              class="icon"
              @click="openDialogChooseFileToImportFrom"
              v-tooltip="$t('preserve_current')"
            >
              <i class="material-icons">folder_special</i>
              <span>{{ $t("import_json") }}</span>
              <input
                type="file"
                @change="importFromJSON"
                style="display: none;"
                ref="inputChooseFileToImportFrom"
                accept="application/json"
              />
            </button>
          </div>
        </li>
      </ul>
    </div>
    <div slot="body">
      <textarea v-model="environmentJson" rows="8"></textarea>
    </div>
    <div slot="footer">
      <div class="flex-wrap">
        <span></span>
        <span>
          <button class="icon" @click="hideModal">
            {{ $t("cancel") }}
          </button>
          <button class="icon primary" @click="exportJSON" v-tooltip="$t('download_file')">
            {{ $t("export") }}
          </button>
        </span>
      </div>
    </div>
  </modal>
</template>

<script>
export default {
  props: {
    show: Boolean,
  },
  components: {
    modal: () => import("../../components/ui/modal"),
  },
  computed: {
    environmentJson() {
      return JSON.stringify(this.$store.state.postwoman.environments, null, 2)
    },
  },
  methods: {
    hideModal() {
      this.$emit("hide-modal")
    },
    openDialogChooseFileToReplaceWith() {
      this.$refs.inputChooseFileToReplaceWith.click()
    },
    openDialogChooseFileToImportFrom() {
      this.$refs.inputChooseFileToImportFrom.click()
    },
    readJSON(file, onSuccess) {
      if (!file) return this.failedImport()
      const reader = new FileReader()
      reader.onload = event => {
        let data
        try {
          data = JSON.parse(event.target.result)
        } catch (e) {
          return this.failedImport()
        }
        onSuccess(data)
      }
      reader.onerror = () => this.failedImport()
      reader.readAsText(file)
    },
    normalizeEnvironments(data) {
      const valid =
        Array.isArray(data) &&
        data.length > 0 &&
        data.every(
          item =>
            item &&
            typeof item === "object" &&
            typeof item.name === "string" &&
            Array.isArray(item.variables)
        )
      return valid ? data : null
    },
    replaceWithJSON() {
      this.readJSON(this.$refs.inputChooseFileToReplaceWith.files[0], data => {
        const environments = this.normalizeEnvironments(data)
        if (!environments) return this.failedImport()
        this.$store.commit("postwoman/replaceEnvironments", environments)
        this.fileImported()
      })
    },
    importFromJSON() {
      this.readJSON(this.$refs.inputChooseFileToImportFrom.files[0], data => {
        const environments = this.normalizeEnvironments(data)
        if (!environments) return this.failedImport()
        this.$store.commit("postwoman/importAddEnvironments", {
          environments,
          confirmation: this.$t("file_imported"),
        })
      })
    },
    exportJSON() {
      let text = this.environmentJson
      text = text.replace(/\n/g, "\r\n")
      let blob = new Blob([text], {
        type: "text/json",
      })
      let anchor = document.createElement("a")
      anchor.download = "postwoman-environment.json"
      anchor.href = window.URL.createObjectURL(blob)
      anchor.target = "_blank"
      anchor.style.display = "none"
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      this.$toast.success(this.$t("download_started"), {
        icon: "done",
      })
    },
    fileImported() {
      this.$toast.info(this.$t("file_imported"), {
        icon: "folder_shared",
      })
    },
    failedImport() {
      this.$toast.error(this.$t("import_failed"), {
        icon: "error",
      })
    },
  },
}
</script>
