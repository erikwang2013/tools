<template>
  <span class="logo-mark">
    <svg viewBox="0 0 32 32" role="img" aria-label="Postwoman">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="currentColor" />
      <path
        d="M9 12.5h12.5M18.5 8l4 4.5-4 4.5M23 19.5H10.5M13.5 15.5l-4 4 4 4"
        fill="none"
        stroke="var(--act-color)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </span>
</template>

<style scoped>
.logo-mark {
  display: inline-flex;
  width: 1.6em;
  height: 1.6em;
  color: var(--ac-color);
}
.logo-mark svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>

<script>
export default {
  props: {
    color: { type: String, default: "" },
  },
}
</script>
