<script setup lang="ts">
import { Dropdown } from 'floating-vue'
import IconButton from '~/components/IconButton.vue'
import { useTraceZoom } from '~/composables/trace-view'

defineProps<{
  disabled?: boolean
}>()

const { level, percent, nextIn, nextOut, zoomIn, zoomOut, resetZoom, fit } = useTraceZoom()
</script>

<template>
  <Dropdown placement="bottom-end" :disabled="disabled">
    <button
      type="button"
      aria-label="Trace zoom"
      data-testid="trace-zoom-trigger"
      :disabled="disabled"
      class="flex items-center gap-1 rounded px-1 text-xs tabular-nums op70 enabled:hover:bg-active enabled:hover:op100 disabled:op40 disabled:cursor-not-allowed"
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
          :disabled="nextOut == null"
          @click="zoomOut()"
        />
        <IconButton
          title="Zoom In"
          icon="i-carbon:add"
          :disabled="nextIn == null"
          @click="zoomIn()"
        />
        <button
          type="button"
          class="rounded border border-base px-2 py-0.5 hover:bg-active"
          @click="fit()"
        >
          Fit
        </button>
        <button
          type="button"
          class="rounded border border-base px-2 py-0.5 enabled:hover:bg-active disabled:op40"
          :disabled="level === 1"
          @click="resetZoom()"
        >
          Reset
        </button>
      </div>
    </template>
  </Dropdown>
</template>
