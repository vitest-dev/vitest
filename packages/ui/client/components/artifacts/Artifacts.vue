<script setup lang="ts">
import type { RunnerTestCase, TestArtifact } from 'vitest'
import type { Component } from 'vue'
import { computed } from 'vue'
import { getLocationString, openLocation } from '~/composables/location'
import VisualRegression from './visual-regression/VisualRegression.vue'

const { test } = defineProps<{ test: RunnerTestCase }>()

interface HandledArtifact { artifact: TestArtifact; component: Component; props: object }

type ComponentProps<T> = T extends new(...args: any) => { $props: infer P } ? NonNullable<P>
  : T extends (props: infer P, ...args: any) => any ? P
    : object

const handledArtifacts = computed<readonly HandledArtifact[]>(() => {
  const handledArtifacts: HandledArtifact[] = []

  for (const artifact of test.artifacts) {
    switch (artifact.type) {
      case 'internal:toMatchScreenshot': {
        if (artifact.kind === 'visual-regression') {
          handledArtifacts.push({
            artifact,
            component: VisualRegression,
            props: { regression: artifact } satisfies ComponentProps<typeof VisualRegression>,
          })
        }

        continue
      }
    }
  }

  return handledArtifacts
})
</script>

<template>
  <template v-if="handledArtifacts.length">
    <h1 m-2>
      Test Artifacts
    </h1>
    <div
      v-for="{ artifact, component, props }, index of handledArtifacts"
      :key="artifact.type + index"
      bg="yellow-500/10"
      text="yellow-500 sm"
      p="x3 y2"
      m-2
      rounded
      role="note"
    >
      <div flex="~ gap-2 items-center justify-between" overflow-hidden>
        <div>
          <span
            v-if="artifact.location && artifact.location.file === test.file.filepath"
            v-tooltip.bottom="'Open in Editor'"
            title="Open in Editor"
            class="flex gap-1 text-yellow-500/80 cursor-pointer"
            ws-nowrap
            @click="openLocation(test, artifact.location)"
          >
            {{ getLocationString(artifact.location) }}
          </span>
          <span
            v-else-if="artifact.location && artifact.location.file !== test.file.filepath"
            class="flex gap-1 text-yellow-500/80"
            ws-nowrap
          >
            {{ getLocationString(artifact.location) }}
          </span>
        </div>
      </div>
      <component :is="component" v-bind="props" />
    </div>
  </template>
</template>
