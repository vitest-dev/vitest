<script setup lang="ts">
import {
  client,
  current,
  currentLogs,
  isReport,
  browserState,
  config,
} from "~/composables/client";
import type { Params } from "~/composables/params";
import { viewMode } from "~/composables/params";
import type { ModuleGraph } from "~/composables/module-graph";
import { getModuleGraph } from "~/composables/module-graph";
import { getProjectNameColor } from "~/utils/task";

const graph = ref<ModuleGraph>({ nodes: [], links: [] });
const draft = ref(false);
const hasGraphBeenDisplayed = ref(false);
const loadingModuleGraph = ref(false);
const currentFilepath = ref<string | undefined>(undefined);

const graphData = computed(() => {
  const c = current.value;
  if (!c || !c.filepath) return;

  return {
    filepath: c.filepath,
    projectName: c.file.projectName || "",
  };
});

function open() {
  const filePath = current.value?.filepath;
  if (filePath) fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`);
}

function changeViewMode(view: Params["view"]) {
  if (view === "graph") hasGraphBeenDisplayed.value = true;

  viewMode.value = view;
}
const consoleCount = computed(() => {
  return currentLogs.value?.reduce((s, { size }) => s + size, 0) ?? 0;
});

function onDraft(value: boolean) {
  draft.value = value;
}

async function loadModuleGraph() {
  if (
    loadingModuleGraph.value ||
    graphData.value?.filepath === currentFilepath.value
  )
    return;

  loadingModuleGraph.value = true;

  await nextTick();

  try {
    const gd = graphData.value;
    if (!gd) return;

    if (
      !currentFilepath.value ||
      gd.filepath !== currentFilepath.value ||
      (!graph.value.nodes.length && !graph.value.links.length)
    ) {
      graph.value = getModuleGraph(
        await client.rpc.getModuleGraph(
          gd.projectName,
          gd.filepath,
          !!browserState
        ),
        gd.filepath
      );
      currentFilepath.value = gd.filepath;
    }
    changeViewMode("graph");
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 100));
    loadingModuleGraph.value = false;
  }
}

debouncedWatch(
  () => [graphData.value, viewMode.value] as const,
  ([, vm]) => {
    if (vm === "graph") loadModuleGraph();
  },
  { debounce: 100, immediate: true }
);
</script>

<template>
  <div
    v-if="current"
    flex
    flex-col
    h-full
    max-h-full
    overflow-hidden
    data-testid="file-detail"
  >
    <div>
      <div p="2" h-10 flex="~ gap-2" items-center bg-header border="b base">
        <StatusIcon :task="current" />
        <div
          v-if="current?.file.projectName"
          font-light
          op-50
          text-sm
          :style="{ color: getProjectNameColor(current?.file.projectName) }"
        >
          [{{ current?.file.projectName || "" }}]
        </div>
        <div flex-1 font-light op-50 ws-nowrap truncate text-sm>
          {{ current?.name }}
        </div>
        <div class="flex text-lg">
          <IconButton
            v-if="!isReport"
            v-tooltip.bottom="'Open in editor'"
            title="Open in editor"
            icon="i-carbon-launch"
            :disabled="!current?.filepath"
            @click="open"
          />
        </div>
      </div>
      <div flex="~" items-center bg-header border="b-2 base" text-sm h-41px>
        <button
          tab-button
          class="flex items-center gap-2"
          :class="{ 'tab-button-active': viewMode == null }"
          data-testid="btn-report"
          @click="changeViewMode(null)"
        >
          <span class="block w-1.4em h-1.4em i-carbon:report"></span>
          Report
        </button>
        <button
          tab-button
          data-testid="btn-graph"
          class="flex items-center gap-2"
          :class="{ 'tab-button-active': viewMode === 'graph' }"
          @click="changeViewMode('graph')"
        >
          <span
            v-if="loadingModuleGraph"
            class="block w-1.4em h-1.4em i-carbon:circle-dash animate-spin animate-2s"
          ></span>
          <span
            v-else
            class="block w-1.4em h-1.4em i-carbon:chart-relationship"
          ></span>
          Module Graph
        </button>
        <button
          v-if="!isReport"
          tab-button
          data-testid="btn-code"
          class="flex items-center gap-2"
          :class="{ 'tab-button-active': viewMode === 'editor' }"
          @click="changeViewMode('editor')"
        >
          <span class="block w-1.4em h-1.4em i-carbon:code"></span>
          {{ draft ? "*&#160;" : "" }}Code
        </button>
        <button
          tab-button
          data-testid="btn-console"
          class="flex items-center gap-2"
          :class="{
            'tab-button-active': viewMode === 'console',
            op20: viewMode !== 'console' && consoleCount === 0,
          }"
          @click="changeViewMode('console')"
        >
          <span class="block w-1.4em h-1.4em i-carbon:terminal-3270"></span>
          Console ({{ consoleCount }})
        </button>
      </div>
    </div>

    <div flex flex-col flex-1 overflow="hidden">
      <div v-if="hasGraphBeenDisplayed" :flex-1="viewMode === 'graph' && ''">
        <ViewModuleGraph
          v-show="viewMode === 'graph' && !loadingModuleGraph"
          :graph="graph"
          data-testid="graph"
          :project-name="current.file.projectName || ''"
        />
      </div>
      <ViewEditor
        v-if="viewMode === 'editor'"
        :key="current.filepath"
        :file="current"
        data-testid="editor"
        @draft="onDraft"
      />
      <ViewConsoleOutput
        v-else-if="viewMode === 'console'"
        :file="current"
        data-testid="console"
      />
      <ViewReport v-else-if="!viewMode" :file="current" data-testid="report" />
    </div>
  </div>
</template>
