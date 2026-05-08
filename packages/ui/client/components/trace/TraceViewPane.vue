<script setup lang="ts">
import { computed } from 'vue'
import IconButton from '~/components/IconButton.vue'
import { activeTrace, closeTrace, getTraceAttemptLabel } from '~/composables/trace-view'
import TraceView from './TraceView.vue'

const trace = computed(() => activeTrace.value?.trace)
const test = computed(() => activeTrace.value?.test)
const attemptLabel = computed(() => trace.value ? getTraceAttemptLabel(trace.value.data) : '')
</script>

<template>
  <div data-testid="trace-view" h-full min-h-0 flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <div class="i-carbon:data-vis-4" />
      <span pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate>Trace Viewer</span>
      <span
        v-if="attemptLabel"
        class="text-xs opacity-70"
      >
        {{ attemptLabel }}
      </span>
      <IconButton
        v-tooltip.bottom="'Close Trace Viewer'"
        title="Close Trace Viewer"
        icon="i-carbon:close"
        @click="closeTrace()"
      />
    </div>
    <TraceView
      v-if="trace && test"
      :trace="trace"
      :test="test"
    />
  </div>
</template>
