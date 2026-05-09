<script setup lang="ts">
import type { TraceSelection } from '~/composables/trace-view'
import { computed } from 'vue'
import IconButton from '~/components/IconButton.vue'
import { closeTrace, getSelectedTrace, getTraceAttemptLabel } from '~/composables/trace-view'
import TraceView from './TraceView.vue'

const props = defineProps<{
  selection: TraceSelection
}>()

const trace = computed(() => getSelectedTrace(props.selection))
const test = computed(() => props.selection.test)
const attemptLabel = computed(() => trace.value ? getTraceAttemptLabel(trace.value) : '')
</script>

<template>
  <div data-testid="trace-view" h-full min-h-0 flex="~ col">
    <div p="3" h-10 flex="~ gap-2" items-center bg-header border="b base">
      <div class="i-carbon:data-vis-4" />
      <span pl-1 font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate>Trace Viewer</span>
      <!-- TODO: pane should own attempt selector here? -->
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
      v-if="trace"
      :trace="trace"
      :test="test"
    />
    <div v-else class="text-sm opacity-50 p-4">
      No trace found
    </div>
  </div>
</template>
