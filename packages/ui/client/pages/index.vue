<script setup lang="ts">
// @ts-expect-error missing types
import { Pane, Splitpanes } from "splitpanes";
import { browserState } from "~/composables/client";
import {
  coverageUrl,
  coverageVisible,
  initializeNavigation,
  detailSizes,
} from "~/composables/navigation";
import { onBrowserPanelResizing } from "~/composables/browser";

const dashboardVisible = initializeNavigation();

const mainSizes = useLocalStorage<[left: number, right: number]>(
  "vitest-ui_splitpanes-mainSizes",
  [33, 67],
  {
    initOnMounted: true,
  }
);

const onMainResized = useDebounceFn((event: { size: number }[]) => {
  event.forEach((e, i) => {
    mainSizes.value[i] = e.size;
  });
}, 0);
const onModuleResized = useDebounceFn((event: { size: number }[]) => {
  event.forEach((e, i) => {
    detailSizes.value[i] = e.size;
  });
  onBrowserPanelResizing(false);
}, 0);

function resizeMain() {
  const width = window.innerWidth;
  const panelWidth = Math.min(width / 3, 300);
  mainSizes.value[0] = (100 * panelWidth) / width;
  mainSizes.value[1] = 100 - mainSizes.value[0];
}
</script>

<template>
  <ProgressBar />
  <div h-screen w-screen overflow="hidden">
    <Splitpanes
      class="pt-4px"
      @resized="onMainResized"
      @resize="onBrowserPanelResizing(true)"
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
            :src="coverageUrl"
          />
          <FileDetails v-else key="details" />
        </transition>
        <Splitpanes
          v-else
          key="browser-detail"
          id="details-splitpanes"
          @resize="onBrowserPanelResizing(true)"
          @resized="onModuleResized"
        >
          <Pane :size="detailSizes[0]" min-size="10">
            <BrowserIframe v-once />
          </Pane>
          <Pane :size="detailSizes[1]" min-size="5">
            <Dashboard v-if="dashboardVisible" key="summary" />
            <Coverage
              v-else-if="coverageVisible"
              key="coverage"
              :src="coverageUrl"
            />
            <FileDetails v-else key="details" />
          </Pane>
        </Splitpanes>
      </Pane>
    </Splitpanes>
  </div>
  <ConnectionOverlay />
</template>
