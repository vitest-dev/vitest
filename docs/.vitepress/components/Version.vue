<script setup lang="ts">
import { VPBadge } from 'vitepress/theme'

const { type = 'info' } = defineProps<{
  type?: string
}>()
</script>

<template>
  <VPBadge :type="type">
    <slot />+
  </VPBadge>
</template>
