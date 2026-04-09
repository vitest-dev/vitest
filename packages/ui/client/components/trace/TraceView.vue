<script setup lang="ts">
import type { BrowserTraceArtifact } from '@vitest/runner'
import type { BrowserTraceData } from '../../../../browser/src/client/tester/trace'
import { createCache, createMirror, rebuild } from 'rrweb-snapshot'
import { computed, ref, watch } from 'vue'

// TODO: review slop (NEVER REMOVE COMMENT)
// - how to highlight selectorq
// - remount on selected test change
// - make it unit-testable for better iteration

const props = defineProps<{
  trace: BrowserTraceArtifact
}>()

const data = computed(() => props.trace.data as BrowserTraceData)
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
  // TODO: slop?
  if (step.selector) {
    try {
      const el = doc.querySelector(step.selector) as HTMLElement | null
      if (el) {
        el.style.outline = '2px solid #3b82f6'
        el.style.outlineOffset = '2px'
      }
    }
    catch {}
  }
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
