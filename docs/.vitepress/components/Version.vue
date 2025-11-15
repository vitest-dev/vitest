<script setup lang="ts">
import { VPBadge } from 'vitepress/theme'

defineProps<{
  type?: 'stable' | 'experimental'
}>()
</script>

<template>
  <VPBadge :type="type === 'experimental' ? 'warning' : 'info'">
    <slot />+
  </VPBadge>
</template>
