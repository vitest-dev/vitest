<script setup lang="ts">
// @ts-expect-error missing types
import { Pane, Splitpanes } from 'splitpanes'
import { browserState } from '~/composables/client'
import {
  coverageUrl,
  coverageVisible,
  detailSizes,
  initializeNavigation,
  mainSizes,
  panels,
} from '~/composables/navigation'

const dashboardVisible = initializeNavigation()

const onBrowserPanelResizing = useDebounceFn((event: { size: number }[]) => {
  // don't trigger events in the iframe while resizing
  preventBrowserEvents()
  recordDetailsResize(event)
}, 0)

const onMainResized = useDebounceFn((event: { size: number }[]) => {
  event.forEach((e, i) => {
    mainSizes.value[i] = e.size
  })
  recordMainResize(event)
}, 0)

const onModuleResized = useDebounceFn((event: { size: number }[]) => {
  event.forEach((e, i) => {
    detailSizes.value[i] = e.size
  })
  recordDetailsResize(event)
  allowBrowserEvents()
}, 0)

const resizingMain = useDebounceFn((event: { size: number }[]) => {
  recordMainResize(event)
  preventBrowserEvents()
}, 0)

function resizeMain() {
  const width = window.innerWidth
  const panelWidth = Math.min(width / 3, 300)
  if (browserState) {
    mainSizes.value[0] = (100 * panelWidth) / width
    mainSizes.value[1] = 100 - mainSizes.value[0]
  }
  else {
    detailSizes.value[0] = (100 * panelWidth) / width
    detailSizes.value[1] = 100 - detailSizes.value[0]
  }
}

function recordMainResize(event: { size: number }[]) {
  panels.navigation = event[0].size
  panels.details.size = event[1].size
}

function recordDetailsResize(event: { size: number }[]) {
  panels.details.browser = event[0].size
  panels.details.main = event[1].size
}

function preventBrowserEvents() {
  const tester = document.querySelector<HTMLDivElement>('#tester-ui')
  if (tester) {
    tester.style.pointerEvents = 'none'
  }
}

function allowBrowserEvents() {
  const tester = document.querySelector<HTMLDivElement>('#tester-ui')
  if (tester) {
    tester.style.pointerEvents = ''
  }
}
</script>

<template>
  <ProgressBar />
  <div h-screen w-screen overflow="hidden">
    <Splitpanes
      class="pt-4px"
      @resized="onMainResized"
      @resize="resizingMain"
      @ready="resizeMain"
    >
      <Pane :size="mainSizes[0]">
        <Navigation />
      </Pane>
      <Pane :size="mainSizes[1]">
        <transition v-if="!browserState" key="ui-detail">
          <Dashboard v-if="dashboardVisible" key="summary" />
          <Coverage
            v-else-if="coverageVisible"
            key="coverage"
            :src="coverageUrl!"
          />
          <FileDetails v-else key="details" />
        </transition>
        <Splitpanes
          v-else
          id="details-splitpanes"
          key="browser-detail"
          @resize="onBrowserPanelResizing"
          @resized="onModuleResized"
        >
          <Pane :size="detailSizes[0]" min-size="10">
            <BrowserIframe v-once />
          </Pane>
          <Pane :size="detailSizes[1]">
            <Dashboard v-if="dashboardVisible" key="summary" />
            <Coverage
              v-else-if="coverageVisible"
              key="coverage"
              :src="coverageUrl!"
            />
            <FileDetails v-else key="details" />
          </Pane>
        </Splitpanes>
      </Pane>
    </Splitpanes>
  </div>
  <ConnectionOverlay />
</template>
