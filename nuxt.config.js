// Some helpful application constants.
// TODO: Use these when rendering the pages (rather than just for head/meta tags...)
export const meta = {
  name: "Postwoman",
  shortDescription: "免费快速的在线 API 调试工具",
  description:
    "Postwoman 是在线 API 请求构建与调试工具，支持 REST、GraphQL、WebSocket、SSE、Socket.IO。免费、快速、开源，是 Postman 的网页替代方案。",
}
const siteUrl = "https://postwoman.erik.xyz"
const defaultLocale = "cn"
const locales = [
  {
    code: "en",
    name: "English",
    iso: "en-US",
    file: "en-US.json",
  },
  {
    code: "es",
    name: "Español",
    iso: "es-ES",
    file: "es-ES.json",
  },
  {
    code: "fr",
    name: "Français",
    iso: "fr-FR",
    file: "fr-FR.json",
  },
  {
    code: "fa",
    name: "Farsi",
    iso: "fa-IR",
    file: "fa-IR.json",
  },
  {
    code: "pt",
    name: "Português Brasileiro",
    iso: "pt-BR",
    file: "pt-BR.json",
  },
  {
    code: "cn",
    name: "简体中文",
    iso: "zh-CN",
    file: "zh-CN.json",
  },
  {
    code: "id",
    name: "Bahasa Indonesia",
    iso: "id-ID",
    file: "id-ID.json",
  },
  {
    code: "tr",
    name: "Türkçe",
    iso: "tr-TR",
    file: "tr-TR.json",
  },
  {
    code: "de",
    name: "Deutsch",
    iso: "de-DE",
    file: "de-DE.json",
  },
  {
    code: "ja",
    name: "日本語",
    iso: "ja-JP",
    file: "ja-JP.json",
  },
  {
    code: "ko",
    name: "한국어",
    iso: "ko-KR",
    file: "ko-KR.json",
  },
]
const localeAlternates = locales.map(locale => ({
  hid: `alternate-hreflang-${locale.iso}`,
  rel: "alternate",
  hreflang: locale.iso,
  href: `${siteUrl}${locale.code === defaultLocale ? "/" : "/" + locale.code}`,
}))
const sitemapPages = ["", "/doc", "/graphql", "/realtime", "/settings", "/protocols"]
const sitemapRoutes = locales
  .map(locale => {
    const prefix = locale.code === defaultLocale ? "" : `/${locale.code}`
    return sitemapPages.map(page => `${prefix}${page}` || "/")
  })
  .reduce((all, list) => all.concat(list), [])
// Sets the base path for the router.
// Important for deploying to GitHub pages.
// -- Travis includes the author in the repo slug,
//    so if there's a /, we need to get everything after it.
let repoName = (process.env.TRAVIS_REPO_SLUG || "").split("/").pop()
export const routerBase =
  process.env.DEPLOY_ENV === "GH_PAGES"
    ? {
        router: {
          base: `/${repoName}/`,
        },
      }
    : {
        router: {
          base: "/",
        },
      }
// node-sass 4.x cannot load on modern Node; prefer dart-sass when installed.
let sassImplementation
try {
  sassImplementation = require("sass")
} catch (e) {
  sassImplementation = undefined
}
export default {
  mode: "spa",
  /*
   ** Headers of the page
   */
  server: {
    host: "0.0.0.0", // default: localhost
  },
  render: {
    bundleRenderer: {
      shouldPreload: (file, type) => {
        return ["script", "style", "font"].includes(type)
      },
    },
  },
  head: {
    title: `${meta.name} \u2022 ${meta.shortDescription}`,
    meta: [
      {
        charset: "utf-8",
      },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover, minimal-ui",
      },
      {
        hid: "description",
        name: "description",
        content: meta.description || "",
      },
      {
        name: "keywords",
        content:
          "postwoman, API 调试, 在线 API 测试, API 请求构建器, 接口调试, 接口测试, postman 替代, REST, GraphQL, WebSocket, SSE, Socket.IO, api testing tool",
      },
      {
        hid: "robots",
        name: "robots",
        content: "index, follow, max-image-preview:large, max-snippet:-1",
      },
      {
        name: "X-UA-Compatible",
        content: "IE=edge, chrome=1",
      },
      {
        itemprop: "name",
        content: `${meta.name} \u2022 ${meta.shortDescription}`,
      },
      {
        itemprop: "description",
        content: meta.description,
      },
      {
        itemprop: "image",
        content: `${siteUrl}/logo.jpg`,
      },
      // Add to homescreen for Chrome on Android. Fallback for PWA (handled by nuxt)
      {
        name: "application-name",
        content: meta.name,
      },
      // Add to homescreen for Safari on iOS
      {
        name: "apple-mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      {
        name: "apple-mobile-web-app-title",
        content: meta.name,
      },
      // Windows phone tile icon
      {
        name: "msapplication-TileImage",
        content: `${routerBase.router.base}icons/icon-144x144.png`,
      },
      {
        name: "msapplication-TileColor",
        content: "#202124",
      },
      {
        name: "msapplication-tap-highlight",
        content: "no",
      },
      // OpenGraph
      {
        property: "og:site_name",
        content: meta.name,
      },
      {
        property: "og:url",
        content: siteUrl,
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        property: "og:title",
        content: `${meta.name} \u2022 ${meta.shortDescription}`,
      },
      {
        property: "og:description",
        content: meta.description,
      },
      {
        property: "og:image",
        content: `${siteUrl}/logo.jpg`,
      },
      // Twitter
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
      {
        name: "twitter:site",
        content: "@liyasthomas",
      },
      {
        name: "twitter:creator",
        content: "@liyasthomas",
      },
      {
        name: "twitter:url",
        content: siteUrl,
      },
      {
        name: "twitter:title",
        content: `${meta.name} \u2022 ${meta.shortDescription}`,
      },
      {
        name: "twitter:description",
        content: meta.description,
      },
      {
        name: "twitter:image",
        content: `${siteUrl}/logo.jpg`,
      },
    ],
    link: [
      {
        rel: "icon",
        type: "image/x-icon",
        href: `${routerBase.router.base}favicon.ico`,
      },
      // Home-screen icons (iOS)
      {
        rel: "apple-touch-icon",
        href: `${routerBase.router.base}icons/icon-48x48.png`,
      },
      {
        rel: "apple-touch-icon",
        sizes: "72x72",
        href: `${routerBase.router.base}icons/icon-72x72.png`,
      },
      {
        rel: "apple-touch-icon",
        sizes: "96x96",
        href: `${routerBase.router.base}icons/icon-96x96.png`,
      },
      {
        rel: "apple-touch-icon",
        sizes: "144x144",
        href: `${routerBase.router.base}icons/icon-144x144.png`,
      },
      {
        rel: "apple-touch-icon",
        sizes: "192x192",
        href: `${routerBase.router.base}icons/icon-192x192.png`,
      },
      {
        hid: "canonical",
        rel: "canonical",
        href: `${siteUrl}/`,
      },
      {
        hid: "alternate-hreflang-x-default",
        rel: "alternate",
        hreflang: "x-default",
        href: `${siteUrl}/`,
      },
      ...localeAlternates,
      {
        rel: "preconnect",
        href: "https://busuanzi.ibruce.info",
      },
      {
        rel: "dns-prefetch",
        href: "//busuanzi.ibruce.info",
      },
    ],
    script: [
      {
        hid: "webapplication-ld-json",
        type: "application/ld+json",
        json: {
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: meta.name,
          url: `${siteUrl}/`,
          description: meta.description,
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Any",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
          inLanguage: ["zh-CN", "en"],
        },
      },
    ],
  },
  /*
   ** Customize the progress-bar color
   */
  loading: {
    color: "var(--ac-color)",
    continuous: true,
  },
  /*
   ** Customize the loading indicator
   */
  loadingIndicator: {
    name: "pulse",
    color: "var(--ac-color)",
    background: "var(--bg-color)",
  },
  /*
   ** Global CSS
   */
  css: ["~/assets/css/styles.scss", "~/assets/css/themes.scss", "~/assets/css/fonts.scss"],
  /*
   ** Plugins to load before mounting the App
   */
  plugins: [
    {
      src: "~/plugins/vuex-persist",
    },
    {
      src: "~/plugins/v-tooltip",
    },
  ],
  /*
   ** Nuxt.js dev-modules
   */
  buildModules: [],
  /*
   ** Nuxt.js modules
   */
  modules: [
    // See https://goo.gl/OOhYW5
    ["@nuxtjs/pwa"],
    ["@nuxtjs/axios"],
    ["@nuxtjs/toast"],
    ["@nuxtjs/sitemap"],
    ["@nuxtjs/robots"],
    ["nuxt-i18n"],
  ],
  pwa: {
    workbox: {
      // The default offline route matches every GET request, so it would cache
      // arbitrary API responses. Keep only the hashed /_nuxt/ asset cache.
      offline: false,
    },
    manifest: {
      name: meta.name,
      short_name: meta.name,

      display: "standalone",

      lang: "zh-CN",
      theme_color: "#202124",
      background_color: "#202124",
      start_url: `${routerBase.router.base}`,
    },

    meta: {
      description: meta.shortDescription,
      theme_color: "#202124",
      lang: false,
    },

    icons: (sizes => {
      let icons = []
      for (let size of sizes) {
        icons.push({
          src: `${routerBase.router.base}icons/icon-${size}x${size}.png`,
          type: "image/png",
          sizes: `${size}x${size}`,
        })
      }
      return icons
    })([48, 72, 96, 144, 192, 512]),
  },
  toast: {
    position: "bottom-center",
    duration: 3000,
    theme: "bubble",
    keepOnHover: true,
  },
  sitemap: {
    hostname: siteUrl,
    trailingSlash: true,
    routes: sitemapRoutes,
  },
  robots: {
    UserAgent: "*",
    Disallow: "",
    Allow: "/",
    Sitemap: `${siteUrl}/sitemap.xml`,
  },
  i18n: {
    locales,
    defaultLocale,
    vueI18n: {
      // zh-CN is missing most keys; fall back to the complete English file.
      fallbackLocale: "en",
    },
    lazy: true,
    langDir: "lang/",
  },
  /*
   ** Build configuration
   */
  build: {
    loaders: sassImplementation
      ? {
          scss: { implementation: sassImplementation },
          sass: { implementation: sassImplementation },
        }
      : {},
    /*
     ** You can extend webpack config here
     */
    extend(config) {
      // Nuxt's babel-loader rule only covers .js/.jsx; protocol modules are .mjs and use
      // syntax (??) that webpack 4's parser cannot read without Babel.
      for (const rule of config.module.rules) {
        if (rule.test instanceof RegExp && rule.test.source === "\\.jsx?$") {
          rule.test = /\.(jsx?|mjs)$/i
        }
      }
    },
  },
  /*
   ** Generate configuration
   */
  generate: {
    fallback: true,
  },
  hooks: {
    // SPA shells are written before Vue mounts, so fill per-route SEO tags at build time.
    "generate:done"(generator) {
      const fs = require("fs")
      const path = require("path")
      const walk = dir => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const file = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            if (entry.name !== "_nuxt") walk(file)
            continue
          }
          if (!entry.name.endsWith(".html")) continue
          const code = path.relative(generator.distPath, dir).split(path.sep)[0] || defaultLocale
          const locale =
            locales.find(l => l.code === code) || locales.find(l => l.code === defaultLocale)
          let html = fs.readFileSync(file, "utf8")

          if (entry.name === "index.html") {
            const rel = path.relative(generator.distPath, file).replace(/index\.html$/, "")
            const route = ("/" + rel.split(path.sep).join("/")).replace(/\/+$/, "") || "/"
            const canonical = `${siteUrl}${route === "/" ? "/" : route}`
            html = html
              .replace(/(<link[^>]*data-hid="canonical"[^>]*href=")[^"]*(")/, `$1${canonical}$2`)
              .replace(/(<meta[^>]*property="og:url"[^>]*content=")[^"]*(")/, `$1${canonical}$2`)
              .replace(/(<meta[^>]*name="twitter:url"[^>]*content=")[^"]*(")/, `$1${canonical}$2`)
          }

          if (!/<html[^>]*\blang=/.test(html)) {
            html = html.replace("<html", `<html lang="${locale.iso}"`)
          }
          fs.writeFileSync(file, html)
        }
      }
      walk(generator.distPath)
    },
  },
  /*
   ** Router configuration
   */
  ...routerBase,
}
