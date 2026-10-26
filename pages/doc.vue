<template>
  <div class="page">
    <pw-section class="blue" :label="$t('collections')" ref="collections">
      <ul>
        <li>
          <p class="info">
            {{ $t("generate_docs_message") }}
          </p>
        </li>
      </ul>
      <ul>
        <li>
          <label for="collectionUpload">
            <button class="icon" @click="$refs.collectionUpload.click()" v-tooltip="$t('json')">
              <pw-icon name="folder" />
              <span>{{ $t("import_collections") }}</span>
            </button>
          </label>
          <input
            ref="collectionUpload"
            name="collectionUpload"
            type="file"
            @change="uploadCollection"
          />
        </li>
      </ul>
      <ul>
        <li>
          <Editor
            v-model="collectionJSON"
            :lang="'json'"
            :lint="false"
            :options="{
              maxLines: '16',
              minLines: '8',
              fontSize: '16px',
              autoScrollEditorIntoView: true,
              showPrintMargin: false,
              useWorker: false,
            }"
          />
        </li>
      </ul>
      <ul>
        <li>
          <button class="icon" @click="getDoc">
            <pw-icon name="book" />
            <span>{{ $t("generate_docs") }}</span>
          </button>
        </li>
      </ul>
    </pw-section>

    <pw-section class="green" :label="$t('documentation')" ref="documentation">
      <p v-if="this.items.length === 0" class="info">
        {{ $t("generate_docs_first") }}
      </p>
      <div>
        <span class="collection" v-for="(collection, index) in this.items" :key="index">
          <h2>
            <pw-icon name="folder" />
            {{ collection.name || $t("none") }}
          </h2>
          <span class="folder" v-for="(folder, index) in collection.folders" :key="index">
            <h3>
              <pw-icon name="folder-open" />
              {{ folder.name || $t("none") }}
            </h3>
            <span class="request" v-for="(request, index) in folder.requests" :key="index">
              <h4>
                <pw-icon name="insert-drive-file" />
                {{ request.name || $t("none") }}
              </h4>
              <p class="doc-desc" v-if="request.url">
                <span>
                  {{ $t("url") }}: <code>{{ request.url || $t("none") }}</code>
                </span>
              </p>
              <p class="doc-desc" v-if="request.path">
                <span>
                  {{ $t("path") }}:
                  <code>{{ request.path || $t("none") }}</code>
                </span>
              </p>
              <p class="doc-desc" v-if="request.method">
                <span>
                  {{ $t("method") }}:
                  <code>{{ request.method || $t("none") }}</code>
                </span>
              </p>
              <p class="doc-desc" v-if="request.auth">
                <span>
                  {{ $t("authentication") }}:
                  <code>{{ request.auth || $t("none") }}</code>
                </span>
              </p>
              <p class="doc-desc" v-if="request.httpUser">
                <span>
                  {{ $t("username") }}:
                  <code>{{ request.httpUser || $t("none") }}</code>
                </span>
              </p>
              <p class="doc-desc" v-if="request.httpPassword">
                <span>
                  {{ $t("password") }}:
                  <code>{{ request.httpPassword || $t("none") }}</code>
                </span>
              </p>
              <p class="doc-desc" v-if="request.bearerToken">
                <span>
                  {{ $t("token") }}:
                  <code>{{ request.bearerToken || $t("none") }}</code>
                </span>
              </p>
              <h4 v-if="(request.headers || []).length > 0">{{ $t("headers") }}</h4>
              <span v-if="request.headers">
                <p v-for="header in request.headers" :key="header.key" class="doc-desc">
                  <span>
                    {{ header.key || $t("none") }}:
                    <code>{{ header.value || $t("none") }}</code>
                  </span>
                </p>
              </span>
              <h4 v-if="(request.params || []).length > 0">{{ $t("parameters") }}</h4>
              <span v-if="request.params">
                <p v-for="parameter in request.params" :key="parameter.key" class="doc-desc">
                  <span>
                    {{ parameter.key || $t("none") }}:
                    <code>{{ parameter.value || $t("none") }}</code>
                  </span>
                </p>
              </span>
              <h4 v-if="request.bodyParams">{{ $t("payload") }}</h4>
              <span v-if="request.bodyParams">
                <p v-for="payload in request.bodyParams" :key="payload.key" class="doc-desc">
                  <span>
                    {{ payload.key || $t("none") }}:
                    <code>{{ payload.value || $t("none") }}</code>
                  </span>
                </p>
              </span>
              <p class="doc-desc" v-if="request.rawParams">
                <span>
                  {{ $t("parameters") }}:
                  <code>{{ request.rawParams || $t("none") }}</code>
                </span>
              </p>
              <p class="doc-desc" v-if="request.contentType">
                <span>
                  {{ $t("content_type") }}:
                  <code>{{ request.contentType || $t("none") }}</code>
                </span>
              </p>
              <p class="doc-desc" v-if="request.requestType">
                <span>
                  {{ $t("request_type") }}:
                  <code>{{ request.requestType || $t("none") }}</code>
                </span>
              </p>
            </span>
          </span>
          <span
            class="request"
            v-for="(request, index) in collection.requests"
            :key="`request-${index}`"
          >
            <h4>
              <pw-icon name="insert-drive-file" />
              {{ request.name || $t("none") }}
            </h4>
            <p class="doc-desc" v-if="request.url">
              <span>
                {{ $t("url") }}: <code>{{ request.url || $t("none") }}</code>
              </span>
            </p>
            <p class="doc-desc" v-if="request.path">
              <span>
                {{ $t("path") }}: <code>{{ request.path || $t("none") }}</code>
              </span>
            </p>
            <p class="doc-desc" v-if="request.method">
              <span>
                {{ $t("method") }}:
                <code>{{ request.method || $t("none") }}</code>
              </span>
            </p>
            <p class="doc-desc" v-if="request.auth">
              <span>
                {{ $t("authentication") }}:
                <code>{{ request.auth || $t("none") }}</code>
              </span>
            </p>
            <p class="doc-desc" v-if="request.httpUser">
              <span>
                {{ $t("username") }}:
                <code>{{ request.httpUser || $t("none") }}</code>
              </span>
            </p>
            <p class="doc-desc" v-if="request.httpPassword">
              <span>
                {{ $t("password") }}:
                <code>{{ request.httpPassword || $t("none") }}</code>
              </span>
            </p>
            <p class="doc-desc" v-if="request.bearerToken">
              <span>
                {{ $t("token") }}:
                <code>{{ request.bearerToken || $t("none") }}</code>
              </span>
            </p>
            <h4 v-if="(request.headers || []).length > 0">{{ $t("headers") }}</h4>
            <span v-if="request.headers">
              <p v-for="header in request.headers" :key="header.key" class="doc-desc">
                <span>
                  {{ header.key || $t("none") }}:
                  <code>{{ header.value || $t("none") }}</code>
                </span>
              </p>
            </span>
            <h4 v-if="(request.params || []).length > 0">{{ $t("parameters") }}</h4>
            <span v-if="request.params">
              <p v-for="parameter in request.params" :key="parameter.key" class="doc-desc">
                <span>
                  {{ parameter.key || $t("none") }}:
                  <code>{{ parameter.value || $t("none") }}</code>
                </span>
              </p>
            </span>
            <h4 v-if="request.bodyParams">{{ $t("payload") }}</h4>
            <span v-if="request.bodyParams">
              <p v-for="payload in request.bodyParams" :key="payload.key" class="doc-desc">
                <span>
                  {{ payload.key || $t("none") }}:
                  <code>{{ payload.value || $t("none") }}</code>
                </span>
              </p>
            </span>
            <p class="doc-desc" v-if="request.rawParams">
              <span>
                {{ $t("parameters") }}:
                <code>{{ request.rawParams || $t("none") }}</code>
              </span>
            </p>
            <p class="doc-desc" v-if="request.contentType">
              <span>
                {{ $t("content_type") }}:
                <code>{{ request.contentType || $t("none") }}</code>
              </span>
            </p>
            <p class="doc-desc" v-if="request.requestType">
              <span>
                {{ $t("request_type") }}:
                <code>{{ request.requestType || $t("none") }}</code>
              </span>
            </p>
          </span>
        </span>
      </div>
    </pw-section>
  </div>
</template>

<style scoped lang="scss">
.collection,
.folder,
.request,
.doc-desc {
  display: flex;
  flex-flow: column;
  flex: 1;
  padding: 12px 14px;
}

.collection {
  margin-bottom: 10px;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius);
  background-color: var(--bg-light-color);
}

.collection > h2,
.folder > h3,
.request > h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
  font-weight: 600;
}

.collection > h2 {
  font-size: 14px;
}

.folder {
  margin: 8px 0 0 14px;
  padding-left: 12px;
  border-left: 1px solid var(--brd-color);
}

.folder > h3 {
  font-size: 13px;
}

.request {
  margin: 8px 0 0;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius-sm);
  background-color: var(--bg-color);
}

.request > h4 {
  font-size: 12.5px;
}

.doc-desc {
  margin: 0;
  padding: 7px 0;
  border-bottom: 1px solid var(--brd-color);
  color: var(--fg-light-color);
  font-size: 12px;

  &:last-child {
    border-bottom: 0;
  }
}

.pw-icon {
  flex: 0 0 auto;
  margin-right: 2px;
  color: var(--fg-light-color);
}

code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  word-break: break-all;
}

.doc-desc span {
  min-width: 0;
}
</style>

<script>
import AceEditor from "../components/ui/ace-editor"

export default {
  components: {
    "pw-section": () => import("../components/layout/section"),
    Editor: AceEditor,
  },

  data() {
    return {
      collectionJSON: "[]",
      items: [],
    }
  },

  methods: {
    uploadCollection() {
      this.rawInput = true
      let file = this.$refs.collectionUpload.files[0]
      if (file !== undefined && file !== null) {
        let reader = new FileReader()
        reader.onload = ({ target }) => {
          this.collectionJSON = target.result
        }
        reader.readAsText(file)
        this.$toast.info(this.$t("file_imported"), {
          icon: "attach_file",
        })
      } else {
        this.$toast.error(this.$t("choose_file"), {
          icon: "attach_file",
        })
      }
    },

    getDoc() {
      try {
        this.items = JSON.parse(this.collectionJSON)
        this.$toast.info(this.$t("docs_generated"), {
          icon: "book",
        })
      } catch (e) {
        this.$toast.error(e, {
          icon: "code",
        })
      }
    },
  },
}
</script>
