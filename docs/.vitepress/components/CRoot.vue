<script setup>
import { Icon } from '@iconify/vue'
</script>

<template>
  <Badge type="warning" title="This options is only available in the top level config. You cannot specify it as an option of a test project." class="croot-badge">
    <Icon icon="carbon:document-configuration" class="croot-icon" />
  </Badge>
</template>

<style scoped>
.croot-badge {
  text-decoration: underline;
  text-decoration-style: dotted;
  cursor: help;
}
.croot-icon {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
  margin-left: -0.25rem;
  margin-right: -0.25rem;
}
</style>
