<script setup lang="ts">
import { getNames } from '@vitest/ws-client'
import { client, currentLogs as logs } from '~/composables/client'
import { isDark } from '~/composables/dark'
import { createAnsiToHtmlFilter } from '~/composables/error'
import { escapeHtml } from '~/utils/escape'

const formattedLogs = computed(() => {
  const data = logs.value
  if (data) {
    const filter = createAnsiToHtmlFilter(isDark.value)
    return data.map(({ taskId, type, time, content }) => ({ taskId, type, time, content: filter.toHtml(escapeHtml(content)) }))
  }

  return undefined
})

function getTaskName(id?: string) {
  const task = id && client.state.idMap.get(id)
  if (task && 'filepath' in task) {
    return task.name
  }
  return (task ? getNames(task).slice(1).join(' > ') : '-') || '-'
}
</script>

<template>
  <div v-if="formattedLogs?.length" h-full class="scrolls" flex flex-col data-testid="logs">
    <div v-for="{ taskId, type, time, content } of formattedLogs" :key="taskId" font-mono>
      <ViewConsoleOutputEntry
        :task-name="getTaskName(taskId)"
        :type="type"
        :time="time"
        :content="content"
      />
    </div>
  </div>
  <p v-else p6>
    Log something in your test and it would print here. (e.g. <pre inline>console.log(foo)</pre>)
  </p>
</template>
