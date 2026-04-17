<script setup lang="ts">
import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import type { BrowserTraceData, BrowserTraceEntry } from '../../../../browser/src/client/tester/trace'
import { createCache, createMirror, rebuild } from 'rrweb-snapshot'
// @ts-expect-error missing types
import { Pane, Splitpanes } from 'splitpanes'
import { computed, ref, watch } from 'vue'
import { getLocationString, openLocation } from '~/composables/location'

// TODO: component test to demo trace view inside trace view

const props = defineProps<{
  trace: BrowserTraceArtifact
  test: RunnerTestCase
}>()

const traceData = computed(() => props.trace.data as BrowserTraceData)
const entries = computed(() => traceData.value.entries)

const selectedStepIndex = ref(0)
const selectedStep = computed(() => entries.value[selectedStepIndex.value])
watch(() => props.trace, () => {
  selectedStepIndex.value = 0
})

const iframeEl = ref<HTMLIFrameElement>()
const iframeSandbox = computed(() => {
  // Canvas replay needs scripts for rrweb's image.onload -> drawImage path,
  // but allow-same-origin + allow-scripts gives replayed app HTML more capability.
  return traceData.value.recordCanvas ? 'allow-same-origin allow-scripts' : 'allow-same-origin'
})

function onSelectStep(index: number) {
  selectedStepIndex.value = index
  const step = entries.value[index]
  if (step?.location) {
    openLocation(props.test, step.location)
  }
}

watch([selectedStep, iframeEl], ([step, iframe]) => {
  if (!step || !iframe) {
    return
  }
  const { serialized, selectorId, viewport, scroll, hoveredIds, activeElementId } = step.snapshot
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
  // `:hover` is supported by rrweb-snapshot; `:focus` is added by our local patch.
  for (const id of hoveredIds ?? []) {
    const el = mirror.getNode(id) as Element | null
    if (el?.classList) {
      el.classList.add(':hover')
    }
  }
  if (activeElementId != null) {
    const el = mirror.getNode(activeElementId) as Element | null
    if (el?.classList) {
      el.classList.add(':focus')
    }
  }
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

function getStepButtonClass(step: BrowserTraceEntry, index: number) {
  const selected = selectedStepIndex.value === index
  if (step.status === 'fail') {
    return selected
      ? 'bg-red-500/20 text-red-600 dark:text-red-400'
      : 'text-red-600 hover:bg-red-500/10 dark:text-red-400'
  }
  return selected ? 'bg-blue-500/20' : 'hover:bg-gray/10'
}

function formatTraceTime(ms: number) {
  return ms < 1000
    ? `${Math.round(ms)}ms`
    : `${(ms / 1000).toFixed(1)}s`
}

function formatTraceTiming(step: BrowserTraceEntry) {
  const startTime = `+${formatTraceTime(step.startTime)}`
  return step.duration == null
    ? startTime
    : `${startTime} · ${formatTraceTime(step.duration)}`
}
</script>

<template>
  <Splitpanes
    class="h-full min-h-0"
  >
    <Pane :size="30" min-size="20">
      <div class="h-full min-h-0 p-4" flex="~ col gap-1" overflow-auto>
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
          <div class="text-xs opacity-60 truncate">
            {{ formatTraceTiming(step) }}
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
    </Pane>
    <Pane :size="70" min-size="20">
      <div class="h-full min-h-0" flex="~ col" overflow-auto>
        <iframe
          v-if="selectedStep"
          ref="iframeEl"
          :key="iframeSandbox"
          :sandbox="iframeSandbox"
          style="background: white; border: none; color-scheme: normal; flex: none"
        />
        <div v-else class="text-sm opacity-50 p-4">
          No trace step selected.
        </div>
      </div>
    </Pane>
  </Splitpanes>
</template>
