<template>
  <div class="field-box">
    <div class="field-title">
      {{ fieldName }}
      <span v-if="fieldArgs.length > 0">
        (
        <span v-for="(field, index) in fieldArgs" :key="index">
          {{ field.name }}:
          <typelink :gqlType="field.type" :jumpTypeCallback="jumpTypeCallback" />
          <span v-if="index !== fieldArgs.length - 1">
            ,
          </span>
        </span>
        ) </span
      >:
      <typelink :gqlType="gqlField.type" :jumpTypeCallback="jumpTypeCallback" />
    </div>
    <div class="field-desc" v-if="gqlField.description">
      {{ gqlField.description }}
    </div>

    <div class="field-deprecated" v-if="gqlField.isDeprecated">
      {{ $t("deprecated") }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.field-box {
  padding: 10px 12px;
  border-bottom: 1px solid var(--brd-color);
}

.field-box:last-child {
  border-bottom: 0;
}

.field-title {
  color: var(--fg-color);
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.field-deprecated {
  display: inline-block;
  padding: 2px 6px;
  margin: 6px 0 0;
  border-radius: 5px;
  background-color: color-mix(in srgb, var(--warning-color) 16%, transparent);
  color: var(--warning-color);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.field-desc {
  margin-top: 5px;
  color: var(--fg-light-color);
  font-size: 12px;
  line-height: 1.5;
}
</style>

<script>
import typelink from "./typelink"

export default {
  components: {
    typelink: typelink,
  },

  props: {
    gqlField: Object,
    jumpTypeCallback: Function,
  },

  computed: {
    fieldString() {
      const args = (this.gqlField.args || []).reduce((acc, arg, index) => {
        return (
          acc +
          `${arg.name}: ${arg.type.toString()}${
            index !== this.gqlField.args.length - 1 ? ", " : ""
          }`
        )
      }, "")
      const argsString = args.length > 0 ? `(${args})` : ""
      return `${this.gqlField.name}${argsString}: ${this.gqlField.type.toString()}`
    },

    fieldName() {
      return this.gqlField.name
    },

    fieldArgs() {
      return this.gqlField.args || []
    },
  },
}
</script>
