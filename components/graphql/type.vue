<template>
  <div class="type-box">
    <div class="type-title">{{ gqlType.name }}</div>
    <div class="type-desc" v-if="gqlType.description">
      {{ gqlType.description }}
    </div>

    <div v-if="gqlType.getFields">
      <h5>{{ $t("fields") }}</h5>
      <div v-for="field in gqlType.getFields()" :key="field.name">
        <gql-field :gqlField="field" :jumpTypeCallback="jumpTypeCallback" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.type-box {
  padding: 12px;
  margin: 0;
}

.type-desc {
  margin-top: 4px;
  color: var(--fg-light-color);
  font-size: 12px;
  line-height: 1.5;
}

.type-title {
  color: var(--fg-color);
  font-family: var(--font-mono);
  font-size: 12.5px;
  font-weight: 600;
}

.type-box h5 {
  margin: 12px 0 4px;
  color: var(--fg-light-color);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
}
</style>

<script>
export default {
  components: {
    "gql-field": () => import("./field"),
  },

  props: {
    gqlType: {},
    jumpTypeCallback: Function,
  },
}
</script>
