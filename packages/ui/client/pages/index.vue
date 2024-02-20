<script setup lang="ts">
// @ts-expect-error missing types
import { Pane, Splitpanes } from 'splitpanes'
import { coverageUrl, coverageVisible, initializeNavigation } from '../composables/navigation'

const dashboardVisible = initializeNavigation()
const mainSizes = useLocalStorage<[left: number, right: number]>('vitest-ui_splitpanes-mainSizes', [33, 67], {
  initOnMounted: true,
})
const detailSizes = useLocalStorage<[left: number, right: number]>('vitest-ui_splitpanes-detailSizes', [33, 67], {
  initOnMounted: true,
})

const onMainResized = useDebounceFn((event: { size: number }[]) => {
  event.forEach((e, i) => {
    mainSizes.value[i] = e.size
  })
}, 0)
const onModuleResized = useDebounceFn((event: { size: number }[]) => {
  event.forEach((e, i) => {
    detailSizes.value[i] = e.size
  })
}, 0)

function resizeMain() {
  const width = window.innerWidth
  const panelWidth = Math.min(width / 3, 300)
  mainSizes.value[0] = (100 * panelWidth) / width
  mainSizes.value[1] = 100 - mainSizes.value[0]
  // initialize suite width with the same navigation panel width in pixels (adjust its % inside detail's split pane)
  detailSizes.value[0] = (100 * panelWidth) / (width - panelWidth)
  detailSizes.value[1] = 100 - detailSizes.value[0]
}
</script>

<template>
  <ProgressBar />
  <div h-screen w-screen overflow="hidden">
    <Splitpanes class="pt-4px" @resized="onMainResized" @ready="resizeMain">
      <Pane :size="mainSizes[0]">
        <Navigation />
      </Pane>
      <Pane :size="mainSizes[1]">
        <transition>
          <Dashboard v-if="dashboardVisible" key="summary" />
          <Coverage v-else-if="coverageVisible" key="coverage" :src="coverageUrl" />
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
