<template>
  <aside class="nav-first">
    <nuxt-link class="brand" :to="localePath('index')" :aria-label="$t('home')">
      <logo class="brand-mark" />
      <span class="brand-name">postwoman</span>
    </nuxt-link>

    <div class="nav-scroll">
      <div class="nav-section">{{ $t("workspace") }}</div>
      <nav class="primary-nav">
        <nuxt-link
          :to="localePath('index')"
          :class="linkActive('/')"
          :aria-label="$t('request')"
        >
          <pw-icon name="home" />
          <span>{{ $t("request") }}</span>
        </nuxt-link>
        <nuxt-link
          :to="localePath('realtime')"
          :class="linkActive('/realtime')"
          :aria-label="$t('realtime')"
        >
          <pw-icon name="realtime" />
          <span>{{ $t("realtime") }}</span>
        </nuxt-link>
        <nuxt-link
          :to="localePath('protocols')"
          :class="linkActive('/protocols')"
          :aria-label="$t('protocols')"
        >
          <pw-icon name="protocols" />
          <span>{{ $t("protocols") }}</span>
        </nuxt-link>
        <nuxt-link
          :to="localePath('graphql')"
          :class="linkActive('/graphql')"
          :aria-label="$t('graphql')"
        >
          <pw-icon name="graphql" />
          <span>{{ $t("graphql") }}</span>
        </nuxt-link>
      </nav>

      <div class="nav-section">{{ $t("reference") }}</div>
      <nav class="primary-nav">
        <nuxt-link
          :to="localePath('guide')"
          :class="linkActive('/guide')"
          :aria-label="$t('guide')"
        >
          <pw-icon name="book-open" />
          <span>{{ $t("guide") }}</span>
        </nuxt-link>
        <nuxt-link
          :to="localePath('doc')"
          :class="linkActive('/doc')"
          :aria-label="$t('documentation')"
        >
          <pw-icon name="book" />
          <span>{{ $t("documentation") }}</span>
        </nuxt-link>
        <nuxt-link
          :to="localePath('settings')"
          :class="linkActive('/settings')"
          :aria-label="$t('settings')"
        >
          <pw-icon name="settings" />
          <span>{{ $t("settings") }}</span>
        </nuxt-link>
      </nav>
    </div>

    <div class="nav-bottom">
      <a
        class="nav-item"
        href="https://github.com/erikwang2013/tools"
        target="_blank"
        rel="noopener"
      >
        <pw-icon name="github" />
        <span>GitHub</span>
      </a>
    </div>
  </aside>
</template>

<script>
export default {
  components: {
    logo: () => import("./logo"),
  },

  methods: {
    linkActive(path) {
      return {
        "nuxt-link-exact-active": this.$route.path === path,
        "nuxt-link-active": this.$route.path === path,
      }
    },
  },
}
</script>
