<script setup lang="ts">
import type { ParsedStack, TestError } from 'vitest'
import { showLocationSource } from '~/composables/codemirror'
import { isTestFile, openInEditor } from '~/composables/error'
import { escapeHtml } from '~/utils/escape'

const props = defineProps<{
  fileId: string
  root: string
  filename?: string
  error: TestError
}>()

function relative(p: string) {
  if (p.startsWith(props.root)) {
    return p.slice(props.root.length)
  }
  return p
}

const filter = computed(() => createAnsiToHtmlFilter(isDark.value))

const isDiffShowable = computed(() => {
  return !!props.error?.diff
})

const diff = computed(() =>
  props.error.diff
    ? filter.value.toHtml(escapeHtml(props.error.diff))
    : undefined,
)

function showCode(stack: ParsedStack) {
  if (isTestFile(stack.file, props.filename)) {
    return showLocationSource(props.fileId, stack)
  }
  return openInEditor(stack.file, stack.line, stack.column)
}
</script>

<template>
  <div class="scrolls scrolls-rounded task-error">
    <pre><b>{{ error.name }}</b>: {{ error.message }}</pre>
    <div
      v-for="(stack, i) of error.stacks"
      :key="i"
      class="op80 flex gap-x-2 items-center"
      data-testid="stack"
    >
      <pre>
 - {{ relative(stack.file) }}:{{ stack.line }}:{{ stack.column }}</pre>
      <div
        v-tooltip.bottom="'Open in Editor'"
        class="i-carbon-launch c-red-600 dark:c-red-400 hover:cursor-pointer min-w-1em min-h-1em"
        tabindex="0"
        aria-label="Open in Editor"
        @click.passive="showCode(stack)"
      />
    </div>
    <template v-if="isDiffShowable">
      <pre data-testid="diff" v-html="diff" />
    </template>
  </div>
</template>

<style scoped>
.task-error {
  --cm-ttc-c-thumb: #ccc;
}
html.dark .task-error {
  --cm-ttc-c-thumb: #444;
}
</style>
