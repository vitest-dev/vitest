<script setup lang="ts">
// @ts-expect-error
import { Pane, Splitpanes } from 'splitpanes'
import type { VueInstance } from '@vueuse/core'
import { provideFileDetailsSize } from '../composables/inject'

const file = ref<VueInstance | null>(null)
provideFileDetailsSize(file)
</script>

<template>
  <div h-screen w-screen overflow="hidden">
    <Splitpanes>
      <Pane size="15">
        <Navigation />
      </Pane>
      <Pane size="15">
        <Suites />
      </Pane>
      <Pane ref="file">
        <FileDetails />
      </Pane>
    </Splitpanes>
  </div>
  <ConnectionOverlay />
</template>
