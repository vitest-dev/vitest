<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  href: string
}>()
</script>

<template>
  <a :href="href" class="button" target="_blank" rel="noopener noreferrer">
    <Icon icon="carbon:document" aria-hidden="true" />
    <span>Changelog</span>
    <Icon icon="carbon:arrow-up-right" class="external-icon" aria-hidden="true" />
  </a>
</template>

<style scoped>
.external-icon {
  width: 0.75rem;
  height: 0.75rem;
}
</style>
