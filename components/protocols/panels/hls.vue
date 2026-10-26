<template>
  <div class="panel">
    <div class="panel-actions">
      <button :disabled="busy || !fields.url" @click="load">{{ $t("load_playlist") }}</button>
    </div>
    <video ref="video" class="panel-video" controls playsinline></video>
  </div>
</template>

<style scoped lang="scss">
.panel-actions {
  padding: 8px 4px;
}

.panel-video {
  width: 100%;
  max-height: 320px;
  border-radius: 8px;
  background: var(--bg-dark-color);
}
</style>

<script>
export default {
  props: {
    fields: {
      type: Object,
      required: true,
    },
  },
  data() {
    return {
      busy: false,
      hls: null,
    }
  },
  beforeDestroy() {
    this.destroy()
  },
  methods: {
    log(message, direction = "info") {
      this.$emit("log", { direction, message })
    },
    fail(error) {
      this.log((error && error.message) || String(error), "error")
    },
    destroy() {
      if (this.hls) this.hls.destroy()
      this.hls = null
    },
    async load() {
      this.busy = true
      this.destroy()
      const video = this.$refs.video
      try {
        const module = await import("hls.js")
        const Hls = module.default || module
        if (!Hls.isSupported()) {
          video.src = this.fields.url
          this.log("Native HLS playback")
          return
        }
        const hls = new Hls()
        this.hls = hls
        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          this.log(`Manifest parsed: ${data.levels.length} levels`)
          if (this.fields.autoplay) video.play().catch(() => {})
        })
        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          const level = hls.levels[data.level]
          if (level) this.log(`Level ${data.level}: ${level.width}x${level.height} @ ${level.bitrate}`)
        })
        hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
          this.log(`Fragment loaded: ${data.frag.relurl || data.frag.url}`)
        })
        hls.on(Hls.Events.ERROR, (_event, data) => {
          this.log(`HLS error: ${data.details} (${data.type})`, "error")
        })
        hls.loadSource(this.fields.url)
        hls.attachMedia(video)
      } catch (error) {
        this.fail(error)
      } finally {
        this.busy = false
      }
    },
  },
}
</script>
