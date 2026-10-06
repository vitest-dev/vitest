<script setup lang="ts">
import { Dropdown } from 'floating-vue'
import { computed } from 'vue'
import IconButton from '~/components/IconButton.vue'
import { traceReplayElement, traceZoom } from '~/composables/trace-view'

const props = defineProps<{
  viewport?: { width: number; height: number }
}>()

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

const percent = computed(() => `${Math.round(traceZoom.value * 100)}%`)
const nextZoomIn = computed(() => ZOOM_LEVELS.find((level) => level > traceZoom.value + 1e-3))
const nextZoomOut = computed(() => ZOOM_LEVELS.findLast((level) => level < traceZoom.value - 1e-3))

function zoomIn() {
  traceZoom.value = nextZoomIn.value ?? traceZoom.value
}

function zoomOut() {
  traceZoom.value = nextZoomOut.value ?? traceZoom.value
}

function fitToPane() {
  const el = traceReplayElement.value
  if (el && props.viewport) {
    traceZoom.value = Math.min(
      el.clientWidth / props.viewport.width,
      el.clientHeight / props.viewport.height,
      1,
    )
  }
}

function resetZoom() {
  traceZoom.value = 1
}
</script>

<template>
  <Dropdown placement="bottom-end">
    <button
      type="button"
      aria-label="Trace zoom"
      data-testid="trace-zoom-trigger"
      class="flex items-center gap-1 rounded px-1 text-xs tabular-nums op70 hover:bg-active hover:op100"
    >
      <span class="i-carbon:zoom-in block" />
      <span>{{ percent }}</span>
    </button>
    <template #popper>
      <div data-testid="trace-zoom-popover" class="flex items-center gap-2 p-1 text-xs">
        <span data-testid="trace-zoom-percent" class="w-10 text-right tabular-nums">{{
          percent
        }}</span>
        <IconButton
          title="Zoom Out"
          icon="i-carbon:subtract"
          :disabled="nextZoomOut == null"
          @click="zoomOut()"
        />
        <IconButton
          title="Zoom In"
          icon="i-carbon:add"
          :disabled="nextZoomIn == null"
          @click="zoomIn()"
        />
        <button
          type="button"
          class="rounded border border-base px-2 py-0.5 hover:bg-active"
          @click="fitToPane()"
        >
          Fit
        </button>
        <button
          type="button"
          class="rounded border border-base px-2 py-0.5 enabled:hover:bg-active disabled:op40"
          :disabled="traceZoom === 1"
          @click="resetZoom()"
        >
          Reset
        </button>
      </div>
    </template>
  </Dropdown>
</template>
