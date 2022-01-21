<script setup lang="ts">
import { getNames } from '@vitest/ws-client'
import { client, currentLogs as logs } from '~/composables/client'

function formatTime(t: number) {
  return (new Date(t)).toLocaleTimeString()
}

function formatConsoleLog(log: string) {
  // TODO: support ASNI colors
  return log.trim()
}

function getTaskName(id?: string) {
  const task = id && client.state.idMap.get(id)
  return task ? getNames(task).slice(1).join(' > ') : '-' || '-'
}
</script>

<template>
  <div v-if="logs?.length" h-full class="scrolls" flex flex-col>
    <div v-for="log of logs" :key="log.taskId" font-mono>
      <div border="b base" p-4>
        <div
          text-xs mb-1
          :class="log.type === 'stderr' ? 'text-red-600 dark:text-red-300': 'op30'"
        >
          {{ formatTime(log.time) }} | {{ getTaskName(log.taskId) }} | {{ log.type }}
        </div>
        <pre v-text="formatConsoleLog(log.content)" />
      </div>
    </div>
  </div>
  <p v-else p6>
    Log something in your test and it would print here. (e.g. <pre inline>console.log(foo)</pre>)
  </p>
</template>
