<script setup lang="ts">
import type { BrowserTraceArtifact } from '@vitest/runner'
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
      TODO
    </template>
  </ArtifactTemplate>
</template>
