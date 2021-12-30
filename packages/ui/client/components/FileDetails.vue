<script setup lang="ts">
import { current } from '~/composables/client'

function open() {
  if (current.value?.filepath)
    fetch(`/__open-in-editor?file=${encodeURIComponent(current.value.filepath)}`)
}

const failed = computed(() => current.value?.tasks.filter(i => i.result?.state === 'fail') || [])
</script>

<template>
  <div v-if="current" h-full w-full overflow="hidden">
    <div
      p="2"
      h-10
      flex="~ gap-2"
      items-center
      bg-header
      border="b base"
    >
      <StatusIcon :task="current" />
      <div flex-1 font-light op-50 ws-nowrap tuncate text-sm>
        {{ current?.filepath }}
      </div>
      <div class="flex text-lg">
        <IconButton
          icon="i-carbon-launch"
          :disabled="!current?.filepath"
          :onclick="open"
        />
      </div>
    </div>
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
    <div overflow="auto">
      <!-- <Editor /> -->
    </div>
  </div>
</template>
