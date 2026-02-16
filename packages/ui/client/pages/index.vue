<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
// @ts-expect-error missing types
import { Pane, Splitpanes } from 'splitpanes'
import BrowserIframe from '~/components/BrowserIframe.vue'
import ClosedDetailsHeader from '~/components/ClosedDetailsHeader.vue'
import ConnectionOverlay from '~/components/ConnectionOverlay.vue'
import Coverage from '~/components/Coverage.vue'
import Dashboard from '~/components/Dashboard.vue'
import FileDetails from '~/components/FileDetails.vue'
import Navigation from '~/components/Navigation.vue'
import ProgressBar from '~/components/ProgressBar.vue'
import { browserState } from '~/composables/client'
import {
  coverageVisible,
  detailSizes,
  detailsPanelVisible,
  detailsPosition,
  initializeNavigation,
  mainSizes,
  panels,
} from '~/composables/navigation'

const dashboardVisible = initializeNavigation()

const onBrowserPanelResizing = useDebounceFn(({ panes }: { panes: { size: number }[] }) => {
  // don't trigger events in the iframe while resizing
  preventBrowserEvents()
  recordDetailsResize(panes)
}, 0)

const onMainResized = useDebounceFn(({ panes }: { panes: { size: number }[] }) => {
  panes.forEach((e, i) => {
    mainSizes.value[i] = e.size
  })
  recordMainResize(panes)
  allowBrowserEvents()
}, 0)

const onModuleResized = useDebounceFn(({ panes }: { panes: { size: number }[] }) => {
  panes.forEach((e, i) => {
    detailSizes.value[i] = e.size
  })
  recordDetailsResize(panes)
  allowBrowserEvents()
}, 0)

const resizingMain = useDebounceFn(({ panes }: { panes: { size: number }[] }) => {
  recordMainResize(panes)
  preventBrowserEvents()
}, 0)

function recordMainResize(panes: { size: number }[]) {
  panels.navigation = panes[0].size
  if (panes[1]) {
    panels.details.size = panes[1].size
  }
}

function recordDetailsResize(panes: { size: number }[]) {
  panels.details.browser = panes[0].size
  if (panes[1]) {
    panels.details.main = panes[1].size
  }
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
          />
          <FileDetails v-else key="details" />
        </transition>
        <template v-else>
          <div
            flex="~ col"
            h-full
          >
            <Splitpanes
              id="details-splitpanes"
              key="browser-detail"
              :horizontal="detailsPosition === 'bottom'"
              :class="detailsPosition === 'bottom' && !detailsPanelVisible ? 'flex-1 min-h-0 overflow-hidden' : 'h-full'"
              @resize="onBrowserPanelResizing"
              @resized="onModuleResized"
            >
              <Pane :size="detailSizes[0]" min-size="10">
                <BrowserIframe v-once />
              </Pane>
              <Pane
                v-if="detailsPanelVisible"
                :size="detailSizes[1]"
                min-size="10"
              >
                <div h-full overflow-hidden>
                  <Dashboard v-if="dashboardVisible" key="summary" />
                  <Coverage
                    v-else-if="coverageVisible"
                    key="coverage"
                  />
                  <FileDetails v-else key="details" />
                </div>
              </Pane>
            </Splitpanes>
            <ClosedDetailsHeader
              v-if="detailsPosition === 'bottom' && !detailsPanelVisible"
            />
          </div>
        </template>
      </Pane>
    </Splitpanes>
  </div>
  <ConnectionOverlay />
</template>
