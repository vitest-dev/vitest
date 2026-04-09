<script setup lang="ts">
import type { BrowserTraceArtifact } from '@vitest/runner'
import { rebuild, createCache, createMirror, snapshot as rrwebSnapshot } from 'rrweb-snapshot'
import { ref, computed, watch } from 'vue'

type RrwebSnapshot = NonNullable<ReturnType<typeof rrwebSnapshot>>

interface TraceStep {
  name: string
  timestamp: number
  stack?: string
  selector?: string
  snapshot?: RrwebSnapshot
}

interface TraceData {
  steps: TraceStep[]
}

const props = defineProps<{
  trace: BrowserTraceArtifact
}>()

const data = computed(() => props.trace.data as TraceData)
const selectedIndex = ref(0)
const selectedStep = computed(() => data.value.steps[selectedIndex.value])
const iframeEl = ref<HTMLIFrameElement>()

watch([selectedStep, iframeEl], ([step, iframe]) => {
  if (!step?.snapshot || !iframe) {
    return
  }
  const doc = iframe.contentDocument!
  doc.open()
  doc.close()
  rebuild(step.snapshot, {
    doc,
    cache: createCache(),
    mirror: createMirror(),
  })
}, { immediate: true })
</script>

<template>
  <div class="grid gap-4 md:grid-cols-[220px_1fr]" style="height: 500px">
    <div flex="~ col gap-1" overflow-auto>
      <button
        v-for="(step, index) of data.steps"
        :key="index"
        type="button"
        class="text-left px-2 py-1 rounded text-sm truncate"
        :class="selectedIndex === index ? 'bg-blue-500/20' : 'hover:bg-gray/10'"
        @click="selectedIndex = index"
      >
        {{ step.name }}
      </button>
    </div>
    <div flex="~ col" overflow-hidden>
      <iframe
        v-if="selectedStep?.snapshot"
        ref="iframeEl"
        sandbox="allow-same-origin"
        style="width: 100%; height: 100%; border: none"
      />
      <div v-else class="text-sm opacity-50 p-2">
        No snapshot for this step.
      </div>
    </div>
  </div>
</template>
