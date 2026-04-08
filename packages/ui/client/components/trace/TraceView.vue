<script setup lang="ts">
import type { BrowserTraceArtifact } from 'vitest'
import ArtifactTemplate from '../artifacts/ArtifactTemplate.vue'
import TraceList from './TraceList.vue'

const props = defineProps<{
  trace: BrowserTraceArtifact
}>()
</script>

<template>
  <template>
    <div
      bg="blue-500/10"
      text="blue-500 sm"
      p="x3 y2"
      m-2
      rounded
      role="note"
    >
      <ArtifactTemplate>
        <template #title>
          Trace
        </template>
        <template #message>
          Existing trace payload attachments exposed through the Vitest-owned trace viewer entry point.
        </template>
        <div font-bold>
          Trace available
        </div>
        <TraceList :trace="trace" />
      </ArtifactTemplate>
    </div>
  </template>
</template>
