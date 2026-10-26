<template>
  <div class="wrapper">
    <div class="content">
      <div class="columns">
        <sidenav />
        <div class="main" id="main">
          <pw-header />
          <nuxt />
          <pw-footer />
        </div>
        <!-- <aside class="nav-second"></aside> -->
      </div>
    </div>
  </div>
</template>

<script>
const { SITE_URL, ROUTES: SEO } = require("~/seo/routes")

export default {
  components: {
    sidenav: () => import("../components/layout/sidenav"),
    "pw-header": () => import("../components/layout/header"),
    "pw-footer": () => import("../components/layout/footer"),
  },

  head() {
    const locales = this.$i18n.locales.map(locale => locale.code)
    const parts = this.$route.path.replace(/\/+$/, "").split("/").filter(Boolean)
    if (parts.length && locales.includes(parts[0])) parts.shift()
    const path = parts.length ? `/${parts.join("/")}` : "/"
    const seo = SEO[path] || SEO["/"]
    const pathname = this.$route.path.replace(/\/+$/, "") || "/"
    const canonical = `${SITE_URL}${pathname === "/" ? "/" : pathname}`
    return {
      htmlAttrs: {
        lang: this.localeIso,
      },
      title: `${seo.title} · Postwoman`,
      meta: [
        { hid: "description", name: "description", content: seo.description },
        { hid: "og:title", property: "og:title", content: `${seo.title} · Postwoman` },
        { hid: "og:description", property: "og:description", content: seo.description },
        { hid: "og:url", property: "og:url", content: canonical },
        { hid: "twitter:title", name: "twitter:title", content: `${seo.title} · Postwoman` },
        { hid: "twitter:description", name: "twitter:description", content: seo.description },
        { hid: "twitter:url", name: "twitter:url", content: canonical },
      ],
      link: [
        {
          hid: "canonical",
          rel: "canonical",
          href: canonical,
        },
      ],
      script: [
        {
          hid: "breadcrumb-ld-json",
          type: "application/ld+json",
          json: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement:
              path === "/"
                ? [{ "@type": "ListItem", position: 1, name: "Postwoman", item: canonical }]
                : [
                    { "@type": "ListItem", position: 1, name: "Postwoman", item: `${SITE_URL}/` },
                    { "@type": "ListItem", position: 2, name: seo.title, item: canonical },
                  ],
          },
        },
      ],
    }
  },

  computed: {
    localeIso() {
      const locale = this.$i18n.locales.find(i => i.code === this.$i18n.locale)
      return (locale && locale.iso) || this.$i18n.locale
    },
  },

  beforeMount() {
    // Load theme settings
    ;(() => {
      // Apply theme from settings.
      document.documentElement.className = this.$store.state.postwoman.settings.THEME_CLASS || ""
      // Load theme color data from settings, or use default color.
      let color = this.$store.state.postwoman.settings.THEME_COLOR || "#4f46e5"
      let vibrant =
        typeof this.$store.state.postwoman.settings.THEME_COLOR_VIBRANT === "undefined"
          ? false
          : this.$store.state.postwoman.settings.THEME_COLOR_VIBRANT
      document.documentElement.style.setProperty("--ac-color", color)
      document.documentElement.style.setProperty(
        "--act-color",
        vibrant ? "rgba(32, 33, 36, 1)" : "rgba(255, 255, 255, 1)"
      )
    })()
  },

  mounted() {
    if (process.client) {
      document.body.classList.add("afterLoad")
    }

    document
      .querySelector("meta[name=theme-color]")
      .setAttribute("content", this.$store.state.postwoman.settings.THEME_TAB_COLOR || "#f6f6f4")

    console.log(
      "%cWe ❤︎ open source!",
      "background-color:white;padding:8px 16px;border-radius:8px;font-size:32px;color:red;"
    )
    console.log(
      "%cContribute: https://github.com/erikwang2013/tools",
      "background-color:black;padding:4px 8px;border-radius:8px;font-size:16px;color:white;"
    )
  },

  beforeDestroy() {
    document.removeEventListener("keydown", this._keyListener)
  },
}
</script>
