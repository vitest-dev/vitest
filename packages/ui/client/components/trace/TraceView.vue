<script setup lang="ts">
import type { BrowserTraceArtifact } from 'vitest'
import ArtifactTemplate from '../artifacts/ArtifactTemplate.vue'

defineProps<{
  trace: BrowserTraceArtifact
}>()
</script>

<template>
  <ArtifactTemplate>
    <template #title>
      Trace
    </template>
    <template #message>
      {{ trace.entries.length }} steps recorded.
    </template>
  </ArtifactTemplate>
</template>
