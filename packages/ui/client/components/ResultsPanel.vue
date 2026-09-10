<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  color?: string
}>()

const open = ref(true)
</script>

<template>
  <div
    :open="open"
    class="results-panel"
    data-testid="results-panel"
    @toggle="open = ($event.target as any).open"
  >
    <div
      class="py-1 text-sm bg-base items-center z-5 gap-2 w-full flex select-none sticky -top-1"
      :class="color"
    >
      <div class="flex-1 h-1px border-base border-b op80" />
      <slot name="summary" :open="open" />
      <div class="flex-1 h-1px border-base border-b op80" />
    </div>
    <slot />
  </div>
</template>

<style>
.results-panel {
  user-select: none;
  width: 100%;
}
</style>
