<script setup lang="ts">
import type { BrowserTraceArtifact } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import type { BrowserTraceData } from '../../../../browser/src/client/tester/trace'
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

const entries = computed(() => (props.trace.data as BrowserTraceData).entries)
const selectedStep = computed(() => entries.value[selectedTraceStepIndex.value])
const iframeEl = ref<HTMLIFrameElement>()

function openStepLocation(index: number) {
  const step = entries.value[index]
  if (!step?.location) {
    return
  }
  selectedTraceStepIndex.value = index
  openLocation(props.test, step.location)
}

watch([selectedStep, iframeEl], ([step, iframe]) => {
  if (!step?.snapshot || !iframe) {
    return
  }
  const { serialized, selectorId } = step.snapshot
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
  <div class="grid h-full min-h-0 gap-4 p-4 md:grid-cols-[220px_1fr]">
    <div flex="~ col gap-1" overflow-auto>
      <button
        v-for="(step, index) of entries"
        :key="index"
        type="button"
        class="text-left px-2 py-1 rounded text-sm"
        :class="selectedTraceStepIndex === index ? 'bg-blue-500/20' : 'hover:bg-gray/10'"
        @click="selectedTraceStepIndex = index"
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
        <!-- TODO: clicking link should also update current step -->
        <div
          v-if="step.location"
          class="text-xs opacity-50 truncate cursor-pointer hover:opacity-80"
          @click.stop="openStepLocation(index)"
        >
          {{ getLocationString(step.location) }}
        </div>
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
