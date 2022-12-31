<script setup lang="ts">
import type { ErrorWithDiff } from '#types'
import { unifiedDiff } from '~/composables/diff'
import { openInEditor, shouldOpenInEditor } from '~/composables/error'

const props = defineProps<{
  root: string
  filename?: string
  error: ErrorWithDiff
}>()

function relative(p: string) {
  if (p.startsWith(props.root))
    return p.slice(props.root.length)
  return p
}

const isDiffShowable = computed(() => {
  return props.error?.expected && props.error?.actual
})

function diff() {
  return unifiedDiff(props.error.actual, props.error.expected, {
    outputTruncateLength: 80,
  })
}
</script>

<template>
  <div class="scrolls scrolls-rounded task-error">
    <pre><b>{{ error.name || error.nameStr }}</b>: {{ error.message }}</pre>
    <div v-for="(stack, i) of error.stacks" :key="i" class="op80 flex gap-x-2 items-center" data-testid="stack">
      <pre> - {{ relative(stack.file) }}:{{ stack.line }}:{{ stack.column }}</pre>
      <div
        v-if="shouldOpenInEditor(stack.file, filename)"
        v-tooltip.bottom="'Open in Editor'"
        class="i-carbon-launch c-red-600 dark:c-red-400 hover:cursor-pointer min-w-1em min-h-1em"
        tabindex="0"
        aria-label="Open in Editor"
        @click.passive="openInEditor(stack.file, stack.line, stack.column)"
      />
    </div>
    <pre v-if="isDiffShowable">
      {{ `\n${diff()}` }}
    </pre>
  </div>
</template>

<style scoped>
.task-error {
  --cm-ttc-c-thumb: #CCC;
}
html.dark .task-error {
  --cm-ttc-c-thumb: #444;
}
</style>
