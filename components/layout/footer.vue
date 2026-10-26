<template>
  <footer class="footer">
    <div class="flex-wrap">
      <span v-if="version.name" class="mono">
        <a
          class="footer-link"
          :href="'https://github.com/erikwang2013/tools/releases/tag/' + version.name"
          target="_blank"
          rel="noopener"
          v-tooltip="'GitHub'"
        >
          {{ version.name }}
        </a>
        <!-- <span v-if="version.hash">
          -
          <a
            :href="'https://github.com/erikwang2013/tools/commit/' + version.hash"
            target="_blank"
            rel="noopener"
          >{{version.hash}}</a>
        </span> -->
        <!-- <span v-if="version.variant">({{version.variant}})</span> -->
      </span>
      <span>
        <a
          class="footer-link"
          href="https://github.com/erikwang2013/tools"
          target="_blank"
          rel="noopener"
          v-tooltip="'GitHub'"
        >
          <pw-icon name="github" />
          GitHub
        </a>
        <v-popover>
          <button class="icon" v-tooltip="$t('choose_language')">
            <pw-icon name="translate" />
          </button>
          <template slot="popover">
            <div v-for="locale in availableLocales" :key="locale.code">
              <nuxt-link :to="switchLocalePath(locale.code)">
                <button class="icon" v-close-popover>
                  {{ locale.name }}
                </button>
              </nuxt-link>
            </div>
          </template>
        </v-popover>
      </span>
    </div>
    <div class="footer-donations">
      <button
        v-for="qr in donateQrs"
        :key="qr.key"
        class="donate-card"
        type="button"
        v-tooltip="'点击放大'"
        @click="openDonate(qr, $event)"
      >
        <img :src="qr.src" :alt="qr.label + '赞赏收款码'" width="64" height="64" loading="lazy" />
        <span>{{ qr.label }}赞赏</span>
      </button>
    </div>
    <div class="footer-legal">
      <span>备案信息：</span>
      <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">
        粤ICP备2020136226号
      </a>
    </div>
    <div class="footer-info" id="busuanzi">
      <span id="busuanzi_container_site_pv">
        本站总访问量 <b id="busuanzi_value_site_pv">0</b> 次 👀
      </span>
      <span class="dot">·</span>
      <span id="busuanzi_container_site_uv">
        访客数 <b id="busuanzi_value_site_uv">0</b> 人次 🧑‍🚀
      </span>
    </div>

    <modal v-if="donatePreview" @close="closeDonate">
      <div slot="header">
        <ul>
          <li>
            <div class="flex-wrap">
              <h3 class="title">{{ donatePreview.label }}赞赏</h3>
              <button ref="donateClose" class="icon" @click="closeDonate">
                <pw-icon name="close" />
              </button>
            </div>
          </li>
        </ul>
      </div>
      <div slot="body">
        <img
          class="donate-qr-large"
          :src="donatePreview.src"
          :alt="donatePreview.label + '赞赏收款码'"
        />
        <p class="info">请使用{{ donatePreview.label }}扫码赞赏，感谢支持 ❤️</p>
      </div>
      <div slot="footer"></div>
    </modal>
  </footer>
</template>

<style scoped lang="scss">
.footer {
  flex-flow: column nowrap;
}

.footer-link {
  margin: 8px 16px;
  color: var(--fg-light-color);

  &:hover {
    color: var(--fg-color);
  }
}

.footer-donations {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  padding: 0 8px 4px;
}

.donate-card {
  margin: 0;
  padding: 6px;
  flex-flow: column nowrap;
  gap: 4px;
  border-radius: 10px;
  background-color: var(--bg-dark-color);
  color: var(--fg-light-color);
  font-size: 12px;
  cursor: zoom-in;

  &:hover,
  &:focus {
    color: var(--fg-color);
  }

  img {
    display: block;
    width: 64px;
    height: 64px;
    border-radius: 8px;
    object-fit: cover;
  }

  span {
    margin-left: 0;
  }
}

.footer-legal {
  display: flex;
  justify-content: center;
  gap: 4px;
  padding: 0 8px;
  color: var(--fg-light-color);
  font-size: 11.5px;

  a {
    color: var(--fg-light-color);
  }

  a:hover {
    color: var(--fg-color);
  }
}

.footer-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  padding: 0 8px 12px;
  color: var(--fg-light-color);
  font-size: 12px;

  b {
    color: var(--fg-color);
    font-weight: 500;
  }
}

.dot {
  margin: 0 6px;
}

.donate-qr-large {
  display: block;
  width: 80vw;
  max-width: 320px;
  height: auto;
  margin: 0 auto 12px;
  border-radius: 12px;
  background-color: #fff;
}
</style>

<script>
import * as version from "../../.postwoman/version.json"

export default {
  components: {
    modal: () => import("../ui/modal"),
  },

  data() {
    return {
      version: {},
      donatePreview: null,
      donateReturnFocus: null,
      donateQrs: [
        { key: "wechat", label: "微信", src: "/images/wechat-pay.jpg" },
        { key: "alipay", label: "支付宝", src: "/images/alipay-pay.jpg" },
      ],
    }
  },

  beforeMount() {
    // Set version data
    this.version = version.default
  },

  mounted() {
    this.loadBusuanzi()
  },

  beforeDestroy() {
    document.removeEventListener("keydown", this.onDonateKeydown)
  },

  computed: {
    availableLocales() {
      return this.$i18n.locales.filter(i => i.code !== this.$i18n.locale)
    },
  },

  methods: {
    loadBusuanzi() {
      if (document.getElementById("busuanzi-script")) return
      const script = document.createElement("script")
      script.id = "busuanzi-script"
      script.async = true
      script.src = "//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"
      document.body.appendChild(script)
    },

    openDonate(qr, event) {
      this.donateReturnFocus = event.currentTarget
      this.donatePreview = qr
      document.addEventListener("keydown", this.onDonateKeydown)
      this.$nextTick(() => this.$refs.donateClose && this.$refs.donateClose.focus())
    },

    closeDonate() {
      this.donatePreview = null
      document.removeEventListener("keydown", this.onDonateKeydown)
      if (this.donateReturnFocus) {
        this.donateReturnFocus.focus()
        this.donateReturnFocus = null
      }
    },

    onDonateKeydown(e) {
      if (e.key === "Escape") this.closeDonate()
    },
  },
}
</script>
