<script setup lang="ts">
import type { BrowserTraceArtifact } from 'vitest'
import { computed, ref } from 'vue'
import { getAttachmentUrl, sanitizeFilePath } from '~/composables/attachments'

const props = defineProps<{
  trace: BrowserTraceArtifact
}>()

const selectedEntryIndex = ref(0)

const selectedEntry = computed(() => {
  return props.trace.entries[selectedEntryIndex.value]
})

function selectEntry(index: number) {
  selectedEntryIndex.value = index
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-[260px_1fr]">
    <div>
      <div font-bold mb-2>
        Steps
      </div>
      <div
        v-if="trace.entries.length"
        flex="~ col gap-2"
      >
        <button
          v-for="(entry, index) of trace.entries"
          :key="`${entry.timestamp}-${entry.name}-${index}`"
          type="button"
          class="text-left rounded border border-blue-500/20 px-3 py-2 hover:bg-blue-500/10"
          :class="{ 'bg-blue-500/15': selectedEntryIndex === index }"
          @click="selectEntry(index)"
        >
          <div font-bold truncate>
            {{ entry.name }}
          </div>
          <div text="blue-500/80 xs" mt-1>
            {{ entry.kind }}
          </div>
        </button>
      </div>
      <div v-else text="blue-500/80">
        No structured steps yet.
      </div>
    </div>

    <div flex="~ col gap-4">
      <div>
        <div font-bold mb-2>
          Selected Step
        </div>
        <div
          v-if="selectedEntry"
          class="rounded border border-blue-500/20 px-3 py-2"
        >
          <div font-bold>
            {{ selectedEntry.name }}
          </div>
          <div text="blue-500/80 xs" mt-1>
            {{ selectedEntry.kind }}
          </div>
          <div
            v-if="selectedEntry.selector"
            mt-3
          >
            <div font-bold text="xs">
              Selector
            </div>
            <code break-all>{{ selectedEntry.selector }}</code>
          </div>
          <div
            v-if="selectedEntry.stack"
            mt-3
          >
            <div font-bold text="xs">
              Stack
            </div>
            <pre overflow-auto text="xs">{{ selectedEntry.stack }}</pre>
          </div>
        </div>
        <div
          v-else
          class="rounded border border-blue-500/20 px-3 py-2 text-blue-500/80"
        >
          No step selected.
        </div>
      </div>
    </div>
  </div>
</template>
