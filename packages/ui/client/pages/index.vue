<script setup lang="ts">
// @ts-expect-error missing types
import { Pane, Splitpanes } from 'splitpanes'
import type { VueInstance } from '@vueuse/core'
import { initializeNavigation } from '../composables/navigation'

const summaryVisible = initializeNavigation()
const mainSizes = reactive([33, 67])
const detailSizes = reactive([33, 67])

const onMainResized = useDebounceFn((event: { size: number }[]) => {
  event.forEach((e, i) => {
    mainSizes[i] = e.size
  })
}, 0)
const onModuleResized = useDebounceFn((event: { size: number }[]) => {
  event.forEach((e, i) => {
    detailSizes[i] = e.size
  })
}, 0)

function resizeMain() {
  const width = window.innerWidth
  const panelWidth = Math.min(width / 3, 300)
  const w = (100 * panelWidth) / width
  mainSizes[0] = w
  mainSizes[1] = 100 - w
  detailSizes[0] = w
  detailSizes[1] = 100 - w
}
</script>

<template>
  <div h-screen w-screen overflow="hidden">
    <Splitpanes @resized="onMainResized" @ready="resizeMain">
      <Pane :size="mainSizes[0]">
        <Navigation />
      </Pane>
      <Pane :size="mainSizes[1]">
        <transition>
          <ReportSummary v-if="summaryVisible" key="summary" />
          <Splitpanes v-else key="detail" @resized="onModuleResized">
            <Pane :size="detailSizes[0]">
              <Suites />
            </Pane>
            <Pane :size="detailSizes[1]">
              <FileDetails />
            </Pane>
          </Splitpanes>
        </transition>
      </Pane>
    </Splitpanes>
  </div>
  <ConnectionOverlay />
</template>
