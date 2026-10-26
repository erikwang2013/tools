<template>
  <div class="show-if-initialized" :class="{ initialized }">
    <pre ref="editor"></pre>
  </div>
</template>

<style lang="scss">
.show-if-initialized {
  opacity: 0;

  &.initialized {
    opacity: 1;
  }

  & > * {
    transition: none;
  }
}
</style>

<script>
const DEFAULT_THEME = "chrome"

import ace from "ace-builds"
import "ace-builds/webpack-resolver"
import jsonParse from "../../functions/jsonParse"
import debounce from "../../functions/utils/debounce"

export default {
  props: {
    value: {
      type: String,
      default: "",
    },
    theme: {
      type: String,
      required: false,
    },
    lang: {
      type: String,
      default: "json",
    },
    lint: {
      type: Boolean,
      default: true,
      required: false,
    },
    options: {
      type: Object,
      default: {},
    },
  },

  data() {
    return {
      initialized: false,
      editor: null,
      cacheValue: "",
    }
  },

  watch: {
    value(value) {
      if (!this.editor) return
      if (value !== this.cacheValue) {
        this.editor.session.setValue(value, 1)
        this.cacheValue = value
        if (this.lint) this.provideLinting(value)
      }
    },
    theme() {
      if (!this.editor) return
      this.initialized = false
      this.editor.setTheme(`ace/theme/${this.defineTheme()}`, () => {
        this.$nextTick().then(() => {
          this.initialized = true
        })
      })
    },
    lang(value) {
      if (!this.editor || value === this._currentLang) return
      this._currentLang = value
      this.editor.getSession().setMode("ace/mode/" + value)
    },
    options(value) {
      if (!this.editor) return
      this.editor.setOptions(value)
    },
  },

  mounted() {
    const editor = ace.edit(this.$refs.editor, {
      mode: `ace/mode/${this.lang}`,
      // ace-builds 1.4.8 can crash while applying JSON folding during init.
      showFoldWidgets: false,
      ...this.options,
    })

    // Set the theme and show the editor only after it's been set to prevent FOUC.
    editor.setTheme(`ace/theme/${this.defineTheme()}`, () => {
      this.$nextTick().then(() => {
        this.initialized = true
      })
    })

    if (this.value) editor.setValue(this.value, 1)

    this.editor = editor
    this.cacheValue = this.value
    this._currentLang = this.lang

    editor.on("change", () => {
      const content = editor.getValue()
      this.$emit("input", content)
      this.cacheValue = content
      if (this.lint) this.provideLinting(content)
    })

    // Disable linting, if lint prop is false
    if (this.lint) this.provideLinting(this.value)
  },

  methods: {
    defineTheme() {
      if (this.theme) {
        return this.theme
      }
      return this.$store.state.postwoman.settings.THEME_ACE_EDITOR || DEFAULT_THEME
    },

    provideLinting: debounce(function(code) {
      // The debounce may fire after the editor was destroyed.
      if (!this.editor || !this.editor.session) return
      if (this.lang === "json") {
        try {
          jsonParse(code)
          this.editor.session.setAnnotations([])
        } catch (e) {
          const pos = this.editor.session.getDocument().indexToPosition(e.start, 0)
          this.editor.session.setAnnotations([
            {
              row: pos.row,
              column: pos.column,
              text: e.message,
              type: "error",
            },
          ])
        }
      }
    }, 2000),
  },

  destroyed() {
    // shortcut: Ace 1.4.8 races on destroy while a mode change is pending
    // (onChangeAnnotation/getAnnotations of null). Drop the reference and let
    // GC collect it; upgrade ace-builds to a version that destroys safely.
    this.editor = null
  },
}
</script>
