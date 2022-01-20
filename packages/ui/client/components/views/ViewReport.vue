<script setup lang="ts">
import type { File } from '#types'
import { config } from '~/composables/client'

const props = defineProps<{
  file?: File
}>()

const failed = computed(() => props.file?.tasks.filter(i => i.result?.state === 'fail') || [])

function relative(p: string) {
  if (p.startsWith(config.value.root))
    return p.slice(config.value.root.length)
  return p
}
</script>

<template>
  <div h-full class="scrolls">
    <template v-if="failed.length">
      <div v-for="task of failed" :key="task.id">
        <div bg="red-500/10" text="red-500 sm" p="x3 y2" m-2 rounded>
          {{ task.name }}

          <div v-if="task.result?.error">
            <pre><b>{{ task.result.error.name || task.result.error.nameStr }}</b>: {{ task.result.error.message }}</pre>
            <pre v-for="stack, i of task.result.error.stacks || []" :key="i" op80> - {{ relative(stack.file) }}:{{ stack.line }}:{{ stack.column }}</pre>
          </div>
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
