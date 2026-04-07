<script setup lang="ts">
import { VPBadge } from '@voidzero-dev/vitepress-theme'

const { type = 'stable' } = defineProps<{
  type?: 'stable' | 'experimental'
}>()
</script>

<template>
  <VPBadge
    :type="type === 'experimental' ? 'warning' : 'info'"
    :title="type === 'experimental' ? 'This feature is experimental and does not follow SemVer.' : undefined"
  >
    <slot />+
  </VPBadge>
</template>
