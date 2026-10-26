<template>
  <div class="page guide-page">
    <section class="guide-hero">
      <span class="eyebrow">{{ $t("guide_eyebrow") }}</span>
      <h1>{{ $t("guide_title") }}</h1>
      <p>{{ $t("guide_lead") }}</p>
      <div class="hero-actions">
        <nuxt-link class="guide-button primary" :to="localePath('index')">
          <pw-icon name="send" />
          <span>{{ $t("guide_start") }}</span>
        </nuxt-link>
        <a
          class="guide-button ghost"
          href="https://github.com/erikwang2013/tools/tree/release/v1.11.1"
          target="_blank"
          rel="noopener"
        >
          <pw-icon name="file" />
          <span>{{ $t("guide_readme") }}</span>
        </a>
      </div>
    </section>

    <section class="guide-grid">
      <article class="guide-card">
        <h2><pw-icon name="send" />{{ $t("guide_quick_start") }}</h2>
        <ol class="guide-steps">
          <li>
            <span class="step-number">1</span>
            <p>{{ $t("guide_step_url") }}</p>
          </li>
          <li>
            <span class="step-number">2</span>
            <p>{{ $t("guide_step_options") }}</p>
          </li>
          <li>
            <span class="step-number">3</span>
            <p>{{ $t("guide_step_send") }}</p>
          </li>
        </ol>
      </article>

      <article class="guide-card">
        <h2><pw-icon name="realtime" />{{ $t("guide_realtime") }}</h2>
        <p>{{ $t("guide_realtime_body") }}</p>
        <nuxt-link class="card-link" :to="localePath('realtime')">
          {{ $t("guide_open_realtime") }}
          <pw-icon name="arrow-right" />
        </nuxt-link>
      </article>

      <article class="guide-card">
        <h2><pw-icon name="protocols" />{{ $t("guide_protocols") }}</h2>
        <p>{{ $t("guide_protocols_body") }}</p>
        <nuxt-link class="card-link" :to="localePath('protocols')">
          {{ $t("guide_open_protocols") }}
          <pw-icon name="arrow-right" />
        </nuxt-link>
      </article>

      <article class="guide-card">
        <h2><pw-icon name="terminal" />{{ $t("guide_agent") }}</h2>
        <p>{{ $t("guide_agent_body") }}</p>
        <code class="guide-code">npm --prefix agent install &amp;&amp; npm run agent</code>
      </article>
    </section>

    <section class="guide-reference">
      <h2>{{ $t("guide_reference") }}</h2>
      <div class="link-grid">
        <a
          class="link-card"
          href="https://github.com/erikwang2013/tools/tree/release/v1.11.1"
          target="_blank"
          rel="noopener"
        >
          <pw-icon name="file" />
          <span>
            <strong>{{ $t("guide_readme") }}</strong>
            <small>{{ $t("guide_readme_desc") }}</small>
          </span>
          <pw-icon name="external" />
        </a>
        <a
          class="link-card"
          href="https://github.com/erikwang2013/tools/blob/release/v1.11.1/docs/protocol-lab.md"
          target="_blank"
          rel="noopener"
        >
          <pw-icon name="protocols" />
          <span>
            <strong>{{ $t("guide_protocol_docs") }}</strong>
            <small>{{ $t("guide_protocol_docs_desc") }}</small>
          </span>
          <pw-icon name="external" />
        </a>
        <nuxt-link class="link-card" :to="localePath('doc')">
          <pw-icon name="book" />
          <span>
            <strong>{{ $t("documentation") }}</strong>
            <small>{{ $t("guide_doc_desc") }}</small>
          </span>
          <pw-icon name="arrow-right" />
        </nuxt-link>
      </div>
    </section>

    <section class="guide-card shortcuts">
      <h2><pw-icon name="keyboard" />{{ $t("guide_shortcuts") }}</h2>
      <div class="shortcut-grid">
        <div><span>{{ $t("send_request") }}</span><kbd>Ctrl/⌘ G</kbd></div>
        <div><span>{{ $t("save_to_collections") }}</span><kbd>Ctrl/⌘ S</kbd></div>
        <div><span>{{ $t("copy_request_link") }}</span><kbd>Ctrl/⌘ K</kbd></div>
        <div><span>{{ $t("reset_request") }}</span><kbd>Ctrl/⌘ L</kbd></div>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.guide-page {
  max-width: 1120px;
}

.guide-hero {
  padding: 34px 0 30px;
  border-bottom: 1px solid var(--brd-color);
  margin-bottom: 22px;
}

.eyebrow {
  color: var(--ac-color);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  max-width: 720px;
  margin: 10px 0 8px;
  font-size: clamp(28px, 5vw, 44px);
  font-weight: 650;
  letter-spacing: -0.04em;
  line-height: 1.08;
}

.guide-hero p {
  max-width: 620px;
  margin: 0;
  color: var(--fg-light-color);
  font-size: 15px;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

.guide-button {
  display: inline-flex;
  align-items: center;
  height: 38px;
  padding: 0 15px;
  gap: 7px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;

  &.primary {
    background: var(--ac-color);
    color: var(--act-color);
  }

  &.ghost {
    border: 1px solid var(--brd-color);
    background: var(--bg-light-color);
    color: var(--fg-color);
  }
}

.guide-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.guide-card,
.guide-reference {
  padding: 20px;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius);
  background: var(--bg-light-color);
  box-shadow: var(--shadow-sm);
}

.guide-card h2,
.guide-reference h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.guide-card h2 .pw-icon,
.guide-reference h2 .pw-icon {
  color: var(--ac-color);
}

.guide-card p {
  margin: 0;
  color: var(--fg-light-color);
  font-size: 13px;
  line-height: 1.6;
}

.guide-steps {
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.guide-steps li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.step-number {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--ac-soft);
  color: var(--ac-color);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
}

.guide-steps p {
  margin: 1px 0 0;
}

.card-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 14px;
  color: var(--ac-color);
  font-size: 12.5px;
  font-weight: 600;
}

.guide-code {
  display: block;
  margin-top: 14px;
  padding: 9px 10px;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius-sm);
  background: var(--bg-color);
  color: var(--fg-color);
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: normal;
}

.guide-reference {
  margin-top: 12px;
}

.link-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.link-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--brd-color);
  border-radius: var(--radius-sm);
  background: var(--bg-color);
  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover {
    border-color: var(--ac-color);
    background: var(--ac-soft);
  }

  > .pw-icon:first-child {
    flex: 0 0 auto;
    color: var(--ac-color);
    margin-top: 2px;
  }

  > .pw-icon:last-child {
    flex: 0 0 auto;
    margin-left: auto;
    margin-top: 2px;
    color: var(--fg-light-color);
  }

  span {
    display: flex;
    flex-flow: column nowrap;
    min-width: 0;
    gap: 2px;
  }

  strong {
    font-size: 12.5px;
    font-weight: 600;
  }

  small {
    color: var(--fg-light-color);
    font-size: 11.5px;
    line-height: 1.45;
  }
}

.shortcuts {
  margin-top: 12px;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 18px;
}

.shortcut-grid > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px solid var(--brd-color);
  color: var(--fg-light-color);
  font-size: 12.5px;
}

.shortcut-grid kbd {
  background: var(--bg-color);
}

@media (max-width: 768px) {
  .guide-grid,
  .link-grid,
  .shortcut-grid {
    grid-template-columns: 1fr;
  }

  .guide-hero {
    padding-top: 12px;
  }
}
</style>

<script>
export default {
  head() {
    const title = `${this.$t("guide")} · Postwoman`
    const description = this.$t("guide_lead")
    return {
      title,
      meta: [{ hid: "description", name: "description", content: description }],
      script: [
        {
          hid: "guide-howto-json",
          type: "application/ld+json",
          json: {
            "@context": "https://schema.org",
            "@type": "HowTo",
            name: this.$t("guide_quick_start"),
            description,
            inLanguage: "zh-CN",
            step: [
              { "@type": "HowToStep", position: 1, text: this.$t("guide_step_url") },
              { "@type": "HowToStep", position: 2, text: this.$t("guide_step_options") },
              { "@type": "HowToStep", position: 3, text: this.$t("guide_step_send") },
            ],
          },
        },
      ],
    }
  },
}
</script>
