<template>
  <modal v-if="show" @close="hideModal">
    <div slot="header">
      <ul>
        <li>
          <div class="flex-wrap">
            <h3 class="title">{{ $t("import_export") }} {{ $t("collections") }}</h3>
            <div>
              <button class="icon" @click="hideModal">
                <pw-icon name="close" />
              </button>
            </div>
          </div>
          <div class="flex-wrap">
            <button
              class="icon"
              @click="openDialogChooseFileToReplaceWith"
              v-tooltip="$t('replace_current')"
            >
              <pw-icon name="create-new-folder" />
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
              <pw-icon name="folder-special" />
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
      <textarea v-model="collectionJson" rows="8"></textarea>
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
    collectionJson() {
      return JSON.stringify(this.$store.state.postwoman.collections, null, 2)
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
    normalizeCollections(data) {
      if (Array.isArray(data)) {
        if (data.length === 0) return null
        const valid = data.every(
          item =>
            item &&
            typeof item === "object" &&
            typeof item.name === "string" &&
            Array.isArray(item.folders) &&
            Array.isArray(item.requests)
        )
        return valid ? data : null
      }
      const isPostman =
        data &&
        data.info &&
        typeof data.info.schema === "string" &&
        data.info.schema.includes("v2.1.0") &&
        Array.isArray(data.item)
      return isPostman ? this.parsePostmanCollection(data) : null
    },
    replaceWithJSON() {
      this.readJSON(this.$refs.inputChooseFileToReplaceWith.files[0], data => {
        const collections = this.normalizeCollections(data)
        if (!collections) return this.failedImport()
        this.$store.commit("postwoman/replaceCollections", collections)
        this.fileImported()
      })
    },
    importFromJSON() {
      this.readJSON(this.$refs.inputChooseFileToImportFrom.files[0], data => {
        const collections = this.normalizeCollections(data)
        if (!collections) return this.failedImport()
        this.$store.commit("postwoman/importCollections", collections)
        this.fileImported()
      })
    },
    exportJSON() {
      let text = this.collectionJson
      text = text.replace(/\n/g, "\r\n")
      let blob = new Blob([text], {
        type: "text/json",
      })
      let anchor = document.createElement("a")
      anchor.download = "postwoman-collection.json"
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
    parsePostmanCollection(collection, folders = true) {
      let postwomanCollection = folders
        ? [{ name: "", folders: [], requests: [] }]
        : { name: "", folders: [], requests: [] }
      const items = Array.isArray(collection.item) ? collection.item : []
      for (let collectionItem of items) {
        if (collectionItem.request) {
          if (postwomanCollection[0]) {
            postwomanCollection[0].name = collection.info ? collection.info.name : ""
            postwomanCollection[0].requests.push(this.parsePostmanRequest(collectionItem))
          } else {
            postwomanCollection.name = collection.name ? collection.name : ""
            postwomanCollection.requests.push(this.parsePostmanRequest(collectionItem))
          }
        } else if (Array.isArray(collectionItem.item) && collectionItem.item.length) {
          const child = this.parsePostmanCollection(collectionItem, false)
          if (postwomanCollection[0]) postwomanCollection[0].folders.push(child)
          else postwomanCollection.folders.push(child)
        }
      }
      return postwomanCollection
    },
    parsePostmanRequest(requestObject) {
      let pwRequest = {
        url: "",
        path: "",
        method: "",
        auth: "",
        httpUser: "",
        httpPassword: "",
        passwordFieldType: "password",
        bearerToken: "",
        headers: [],
        params: [],
        bodyParams: [],
        rawParams: "",
        rawInput: false,
        contentType: "",
        requestType: "",
        name: "",
      }

      const request = requestObject.request || {}
      pwRequest.name = requestObject.name || ""
      const rawUrl =
        typeof request.url === "string" ? request.url : (request.url && request.url.raw) || ""
      const requestObjectUrl = rawUrl.match(/^(.+:\/\/[^\/]+|{[^\/]+})(\/[^\?]+|).*$/)
      pwRequest.url = requestObjectUrl ? requestObjectUrl[1] : ""
      pwRequest.path = requestObjectUrl && requestObjectUrl[2] ? requestObjectUrl[2] : ""
      pwRequest.method = request.method || "GET"
      const itemAuth = request.auth || ""
      const authType = itemAuth ? itemAuth.type : ""
      if (authType === "basic" && Array.isArray(itemAuth.basic)) {
        const user = itemAuth.basic.find(item => item.key === "username")
        const password = itemAuth.basic.find(item => item.key === "password")
        pwRequest.auth = "Basic Auth"
        pwRequest.httpUser = user ? user.value : ""
        pwRequest.httpPassword = password ? password.value : ""
      } else if (authType === "oauth2" && Array.isArray(itemAuth.oauth2)) {
        const token = itemAuth.oauth2.find(item => item.key === "accessToken")
        pwRequest.auth = "OAuth 2.0"
        pwRequest.bearerToken = token ? token.value : ""
      } else if (authType === "bearer" && Array.isArray(itemAuth.bearer)) {
        pwRequest.auth = "Bearer Token"
        pwRequest.bearerToken = itemAuth.bearer[0] ? itemAuth.bearer[0].value : ""
      }
      if (Array.isArray(request.header)) {
        pwRequest.headers = request.header.filter(item => item && typeof item === "object")
        for (let header of pwRequest.headers) {
          delete header.name
          delete header.type
        }
      }
      const urlObject = request.url && typeof request.url === "object" ? request.url : null
      if (urlObject && Array.isArray(urlObject.query)) {
        pwRequest.params = urlObject.query
        for (let param of pwRequest.params) {
          delete param.disabled
        }
      }
      if (request.body && request.body.mode === "urlencoded" && Array.isArray(request.body.urlencoded)) {
        pwRequest.bodyParams = request.body.urlencoded
        for (let param of pwRequest.bodyParams) {
          delete param.type
        }
      } else if (request.body && request.body.mode === "raw") {
        pwRequest.rawInput = true
        pwRequest.rawParams = request.body.raw || ""
      }
      return pwRequest
    },
  },
}
</script>
