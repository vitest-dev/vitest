<script setup lang="ts">
import type { UserConsoleLog } from '#types'

const props = defineProps<{
  taskName: string
  type: UserConsoleLog['type']
  time: UserConsoleLog['time']
  content: UserConsoleLog['content']
  html: boolean
}>()

function formatTime(t: number) {
  return (new Date(t)).toLocaleTimeString()
}

</script>
<template>
  <div border="b base" p-4>
    <div
      text-xs mb-1
      :class="props.type === 'stderr' ? 'text-red-600 dark:text-red-300': 'op30'"
    >
      {{ formatTime(time) }} | {{ props.taskName }} | {{ props.type }}
    </div>
    <pre v-if="html" data-type="html" v-html="content" />
    <pre v-else data-type="text" v-text="content" />
  </div>
</template>
