<script setup lang="ts">
import type { UserConsoleLog } from 'vitest'

defineProps<{
  taskName: string
  type: UserConsoleLog['type']
  time: UserConsoleLog['time']
  content: UserConsoleLog['content']
}>()

function formatTime(t: number) {
  return new Date(t).toLocaleTimeString()
}
</script>

<template>
  <div border="b base" p-4>
    <div
      text-xs
      mb-1
      :class="type === 'stderr' ? 'text-red-600 dark:text-red-300' : 'op30'"
    >
      {{ formatTime(time) }} | {{ taskName }} | {{ type }}
    </div>
    <pre data-type="html" v-html="content" />
  </div>
</template>
