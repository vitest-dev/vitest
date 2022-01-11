<script setup lang="ts">
// @ts-expect-error missing types
import { Pane, Splitpanes } from 'splitpanes'
import { initializeNavigation } from '../composables/navigation'

const dashboardVisible = initializeNavigation()
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
  mainSizes[0] = (100 * panelWidth) / width
  mainSizes[1] = 100 - mainSizes[0]
  // initialize suite width with the same navigation panel width in pixels (adjust % inside detail's split pane)
  detailSizes[0] = (100 * panelWidth) / (width - panelWidth)
  detailSizes[1] = 100 - detailSizes[0]
}
</script>

<template>
  <ProgressBar />
  <div h-screen w-screen overflow="hidden">
    <Splitpanes @resized="onMainResized" @ready="resizeMain">
      <Pane :size="mainSizes[0]">
        <Navigation />
      </Pane>
      <Pane :size="mainSizes[1]">
        <transition>
          <Dashboard v-if="dashboardVisible" key="summary" />
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
