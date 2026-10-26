<template>
  <header class="header">
    <div class="flex-wrap">
      <span class="header-left">
        <nuxt-link class="mobile-brand" :to="localePath('index')" :aria-label="$t('home')">
          <logo class="brand-mark" />
        </nuxt-link>
        <span class="page-title">{{ pageTitle }}</span>
      </span>

      <span class="header-actions">
        <nuxt-link v-if="!isGuidePage" class="header-guide desktop-only" :to="localePath('guide')">
          <pw-icon name="book-open" />
          <span>{{ $t("guide") }}</span>
        </nuxt-link>

        <button
          v-if="showInstallPrompt"
          class="icon"
          id="installPWA"
          :aria-label="$t('install_pwa')"
          v-tooltip="$t('install_pwa')"
          @click.prevent="showInstallPrompt()"
        >
          <pw-icon name="download" />
        </button>

        <v-popover>
          <button class="icon" :aria-label="$t('more')" v-tooltip="$t('more')">
            <pw-icon name="more" />
          </button>
          <template slot="popover">
            <div>
              <button class="icon menu-item" @click="showExtensions = true" v-close-popover>
                <pw-icon name="extension" />
                <span>{{ $t("extensions") }}</span>
              </button>
            </div>
            <div>
              <button class="icon menu-item" @click="showShortcuts = true" v-close-popover>
                <pw-icon name="keyboard" />
                <span>{{ $t("shortcuts") }}</span>
              </button>
            </div>
            <div>
              <a
                class="menu-link"
                href="https://github.com/erikwang2013/tools"
                target="_blank"
                rel="noopener"
              >
                <button class="icon menu-item">
                  <pw-icon name="github" />
                  <span>GitHub</span>
                </button>
              </a>
            </div>
          </template>
        </v-popover>
      </span>
    </div>

    <modal v-if="showExtensions" @close="showExtensions = false">
      <div slot="header">
        <div class="modal-head">
          <h3 class="title">{{ $t("extensions") }}</h3>
          <button class="icon" :aria-label="$t('close')" @click="showExtensions = false">
            <pw-icon name="close" />
          </button>
        </div>
      </div>
      <div slot="body">
        <p class="info">{{ $t("extensions_info1") }}</p>
        <div>
          <a
            href="https://addons.mozilla.org/en-US/firefox/addon/postwoman"
            target="_blank"
            rel="noopener"
          >
            <button class="icon">
              <pw-icon name="public" />
              <span>Firefox</span>
              <span v-if="firefoxExtInstalled" v-tooltip="$t('installed')">
                <pw-icon name="done" />
              </span>
            </button>
          </a>
        </div>
        <div>
          <a
            href="https://chrome.google.com/webstore/detail/postwoman-extension-for-c/amknoiejhlmhancpahfcfcfhllgkpbld"
            target="_blank"
            rel="noopener"
          >
            <button class="icon">
              <pw-icon name="public" />
              <span>Chrome</span>
              <span v-if="chromeExtInstalled" v-tooltip="$t('installed')">
                <pw-icon name="done" />
              </span>
            </button>
          </a>
        </div>
      </div>
      <div slot="footer"></div>
    </modal>

    <modal v-if="showShortcuts" @close="showShortcuts = false">
      <div slot="header">
        <div class="modal-head">
          <h3 class="title">{{ $t("shortcuts") }}</h3>
          <button class="icon" :aria-label="$t('close')" @click="showShortcuts = false">
            <pw-icon name="close" />
          </button>
        </div>
      </div>
      <div slot="body" class="shortcut-list">
        <div>
          <label>{{ $t("send_request") }}</label>
          <kbd>{{ getSpecialKey() }} G</kbd>
        </div>
        <div>
          <label>{{ $t("save_to_collections") }}</label>
          <kbd>{{ getSpecialKey() }} S</kbd>
        </div>
        <div>
          <label>{{ $t("copy_request_link") }}</label>
          <kbd>{{ getSpecialKey() }} K</kbd>
        </div>
        <div>
          <label>{{ $t("reset_request") }}</label>
          <kbd>{{ getSpecialKey() }} L</kbd>
        </div>
      </div>
      <div slot="footer"></div>
    </modal>


  </header>
</template>

<style scoped lang="scss">
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mobile-brand {
  display: none;
  color: var(--ac-color);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.header-guide {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 10px;
  gap: 6px;
  border-radius: var(--radius-sm);
  color: var(--fg-light-color);
  font-size: 12.5px;
  font-weight: 500;

  &:hover {
    background-color: var(--bg-dark-color);
    color: var(--fg-color);
  }
}

.menu-link {
  display: block;
  width: 100%;
}

.menu-item {
  width: 100%;
  height: 34px;
  justify-content: flex-start;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 13px;

  span {
    margin-left: 2px;
  }
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.shortcut-list > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--brd-color);

  &:last-child {
    border-bottom: 0;
  }
}

@media (max-width: 768px) {
  .mobile-brand {
    display: inline-flex;
    width: 24px;
    height: 24px;
  }

  .header-left {
    gap: 8px;
  }

  .header-guide {
    display: none;
  }
}
</style>

<script>
import intializePwa from "../../assets/js/pwa"
import { hasExtensionInstalled } from "../../functions/strategies/ExtensionStrategy"
import { hasChromeExtensionInstalled } from "../../functions/strategies/ChromeStrategy"
import { getPlatformSpecialKey } from "../../functions/platformutils"

const TITLES = {
  "/": "request",
  "/realtime": "realtime",
  "/protocols": "protocols",
  "/graphql": "graphql",
  "/doc": "documentation",
  "/settings": "settings",
  "/guide": "guide",
}

export default {
  components: {
    logo: () => import("./logo"),
    modal: () => import("../ui/modal"),
  },

  data() {
    return {
      showInstallPrompt: null,
      showExtensions: false,
      showShortcuts: false,
    }
  },

  computed: {
    pageTitle() {
      const locales = this.$i18n.locales.map(locale => locale.code)
      const parts = this.$route.path.replace(/\/+$/, "").split("/").filter(Boolean)
      if (parts.length && locales.includes(parts[0])) parts.shift()
      const path = parts.length ? `/${parts.join("/")}` : "/"
      return this.$t(TITLES[path] || "request")
    },
    isGuidePage() {
      return /(^|\/)guide\/?$/.test(this.$route.path)
    },
    firefoxExtInstalled() {
      return hasExtensionInstalled()
    },
    chromeExtInstalled() {
      return hasChromeExtensionInstalled()
    },

  },

  mounted() {
    ;(async () => {
      this.showInstallPrompt = await intializePwa()
      const cookiesAllowed = localStorage.getItem("cookiesAllowed") === "yes"
      if (!cookiesAllowed) {
        this.$toast.show(this.$t("we_use_cookies"), {
          icon: "info",
          duration: 5000,
          theme: "toasted-primary",
          action: [
            {
              text: this.$t("dismiss"),
              onClick: (e, toastObject) => {
                localStorage.setItem("cookiesAllowed", "yes")
                toastObject.goAway(0)
              },
            },
          ],
        })
      }

      const showExtensionsToast = localStorage.getItem("showExtensionsToast") === "yes"
      if (!showExtensionsToast) return

      setTimeout(() => {
        if (!(hasExtensionInstalled() || hasChromeExtensionInstalled())) {
          this.$toast.show(this.$t("extensions_info2"), {
            icon: "extension",
            duration: 5000,
            theme: "toasted-primary",
            action: [
              {
                text: this.$t("yes"),
                onClick: (e, toastObject) => {
                  this.showExtensions = true
                  localStorage.setItem("showExtensionsToast", "yes")
                  toastObject.goAway(0)
                },
              },
              {
                text: this.$t("no"),
                onClick: (e, toastObject) => {
                  localStorage.setItem("showExtensionsToast", "no")
                  toastObject.goAway(0)
                },
              },
            ],
          })
        }
      }, 15000)

      this._keyListener = function(e) {
        if (e.key === "Escape") {
          e.preventDefault()
          this.showExtensions = this.showShortcuts = false
        }
      }.bind(this)
      document.addEventListener("keydown", this._keyListener)
    })()
  },

  beforeDestroy() {
    document.removeEventListener("keydown", this._keyListener)
  },

  methods: {
    getSpecialKey: getPlatformSpecialKey,

  },
}
</script>
