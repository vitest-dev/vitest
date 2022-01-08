<script setup lang="ts">
import type { File } from '#types'

const props = withDefaults(defineProps<{
  file?: File
  showConsoleOutput?: boolean
}>(), {
  showConsoleOutput: true
})

const consoleOutput = computed(() => props.file?.tasks?.map(i => i?.logs || []).flat() || []);
</script>

<template>
  <div w-full>
    <div flex justify-between cursor-pointer p="x4 y2" bg-header h-auto all:transition-400 @click="showConsoleOutput = !showConsoleOutput">
      <p>
        Console output ({{ consoleOutput?.length || 0 }})
      </p>
      <IconButton icon="i-carbon-caret-down" :class="showConsoleOutput ? 'rotate-180' : 'rotate-0'" :disabled="!ctx?.length"  />
    </div>
    <template v-if="!showConsoleOutput">
      <div p="x4 y6">
        <div v-for="log of consoleOutput">
          {{ log.content }}
        </div>
      </div>
    </template>
  </div>
</template>
