<script setup lang="ts">
import type { File } from '#types'

const props = defineProps<{
  file?: File
}>()

const failed = computed(() => props.file?.tasks.filter(i => i.result?.state === 'fail') || [])
</script>

<template>
  <div>
    <template v-if="failed.length">
      <div v-for="task of failed" :key="task.id">
        <div bg="red-500/10" text="red-500 sm" p="x3 y2" m-2 rounded>
          {{ task.name }}
          <!-- TODO: show diff and better stacktrace -->
          <pre op80>{{ (task.result?.error as any).stackStr }}</pre>
        </div>
      </div>
    </template>
    <template v-else>
      <div bg="green-500/10" text="green-500 sm" p="x4 y2" m-2 rounded>
        All tests passed in this file
      </div>
    </template>
  </div>
</template>
