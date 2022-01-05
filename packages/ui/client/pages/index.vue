<script setup lang="ts">
// @ts-expect-error
import { Pane, Splitpanes } from 'splitpanes'
import { provideCurrentModule } from '../composables/navigation'
provideCurrentModule()
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
      <Pane>
        <FileDetails />
      </Pane>
    </Splitpanes>
  </div>
  <ConnectionOverlay />
</template>
