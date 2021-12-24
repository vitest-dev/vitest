<script setup lang="ts">
import type { File } from 'vitest'
import { activeFileId, connectionStatus, fileMetadata, tasksCtx } from './context'
import { pickTasksFromFile, restoreTestFileStructure } from './utils'

const { status, data, send } = useWebSocket('ws://localhost:51204/__vitest_api')

const activeFileIdRef = ref('')

const files = computed<File[]>(() => JSON.parse(data.value || '[]').filter((x: File) => x))
const tasks = computed(() => {
  if (!activeFileIdRef.value || !files.value || !files.value.length)
    return null

  const file = files.value.find(file => file.id === activeFileIdRef.value)

  if (file)
    return pickTasksFromFile(restoreTestFileStructure(file))
  return null
})

provide(fileMetadata, files)
provide(connectionStatus, status)
provide(activeFileId, activeFileIdRef)
provide(tasksCtx, tasks)

</script>

<template>
  <div
    flex
  >
    <Navigation />
    <Suites />
  </div>
</template>
