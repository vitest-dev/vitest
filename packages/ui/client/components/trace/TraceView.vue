<script setup lang="ts">
import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import type { BrowserTraceData, BrowserTraceEntry } from '../../../../browser/src/client/tester/trace'
import { createCache, createMirror, rebuild } from 'rrweb-snapshot'
import { computed, ref, watch } from 'vue'
import { getLocationString, openLocation } from '~/composables/location'
import { selectedTraceStepIndex } from '~/composables/trace-view'

// TODO: review slop (NEVER REMOVE COMMENT)
// - remount on selected test change
// - make it unit-testable for better iteration

const props = defineProps<{
  trace: BrowserTraceArtifact
  test: RunnerTestCase
}>()

const traceData = computed(() => props.trace.data as BrowserTraceData)
const entries = computed(() => traceData.value.entries)
const selectedStep = computed(() => entries.value[selectedTraceStepIndex.value])
const iframeSandbox = computed(() => {
  // TODO(docs): document that recordCanvas enables a weaker iframe sandbox.
  // Canvas replay needs scripts for rrweb's image.onload -> drawImage path,
  // but allow-same-origin + allow-scripts gives replayed app HTML more capability.
  return traceData.value.recordCanvas ? 'allow-same-origin allow-scripts' : 'allow-same-origin'
})
const iframeEl = ref<HTMLIFrameElement>()

function getStepButtonClass(step: BrowserTraceEntry, index: number) {
  const selected = selectedTraceStepIndex.value === index
  if (step.status === 'fail') {
    return selected
      ? 'bg-red-500/20 text-red-600 dark:text-red-400'
      : 'text-red-600 hover:bg-red-500/10 dark:text-red-400'
  }
  return selected ? 'bg-blue-500/20' : 'hover:bg-gray/10'
}

function onSelectStep(index: number) {
  selectedTraceStepIndex.value = index
  const step = entries.value[index]
  if (step?.location) {
    openLocation(props.test, step.location)
  }
}

watch([selectedStep, iframeEl], ([step, iframe]) => {
  if (!step?.snapshot || !iframe) {
    return
  }
  const { serialized, selectorId, viewport, scroll } = step.snapshot
  iframe.style.width = `${viewport.width}px`
  iframe.style.height = `${viewport.height}px`
  // Rebuild snapshot into iframe contentDocument — pattern from rrweb replayer:
  // https://github.com/rrweb-io/rrweb/blob/master/packages/rrweb/src/replay/index.ts
  // doc.open/close resets the iframe document to a blank state before rebuild.
  // Unlike Playwright which serves snapshots via HTTP, this is fully client-side
  // but external resources (images, stylesheets) won't load without a server.
  const doc = iframe.contentDocument!
  doc.open()
  doc.close()
  const mirror = createMirror()
  rebuild(serialized, {
    doc,
    cache: createCache(),
    mirror,
  })
  iframe.contentWindow!.scrollTo(scroll?.x ?? 0, scroll?.y ?? 0)
  if (selectorId != null) {
    const el = mirror.getNode(selectorId)
    if (el) {
      // Overlay highlight technique adapted from Playwright's highlight.ts:
      // https://github.com/microsoft/playwright/blob/main/packages/injected/src/highlight.ts
      // getBoundingClientRect() gives viewport-relative coords; position:fixed overlay matches.
      // Simplified version: no shadow DOM glass pane, no tooltip.
      iframe.contentWindow!.requestAnimationFrame(() => {
        const rect = (el as Element).getBoundingClientRect()
        const overlay = doc.createElement('div')
        overlay.setAttribute('data-testid', 'trace-view-highlight')
        overlay.style.cssText = `
          position: fixed;
          pointer-events: none;
          z-index: 2147483647;
          left: ${rect.left}px;
          top: ${rect.top}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background: rgba(59, 130, 246, 0.15);
          border: 2px solid #3b82f6;
          box-sizing: border-box;
        `
        doc.documentElement.appendChild(overlay)
      })
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="grid h-full min-h-0 gap-4 p-4 md:grid-cols-[220px_1fr]" data-testid="trace-view">
    <!-- TODO: split pane between step list and viewer?  -->
    <div flex="~ col gap-1" overflow-auto>
      <button
        v-for="(step, index) of entries"
        :key="index"
        type="button"
        class="text-left px-2 py-1 rounded text-sm"
        :class="getStepButtonClass(step, index)"
        @click="onSelectStep(index)"
      >
        <div truncate>
          {{ step.name }}
        </div>
        <div
          v-if="step.selector"
          class="font-mono text-xs opacity-70 truncate"
        >
          {{ step.selector }}
        </div>
        <div
          v-if="step.location"
          class="text-xs opacity-50 truncate"
        >
          {{ getLocationString(step.location) }}
        </div>
      </button>
    </div>
    <div flex="~ col" overflow-auto>
      <iframe
        v-if="selectedStep?.snapshot"
        ref="iframeEl"
        :key="iframeSandbox"
        :sandbox="iframeSandbox"
        style="border: none; flex: none"
      />
      <div v-else class="text-sm opacity-50 p-2">
        No snapshot for this step.
      </div>
    </div>
  </div>
</template>
