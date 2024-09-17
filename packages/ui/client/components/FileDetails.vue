<script setup lang="ts">
import { hasFailedSnapshot } from '@vitest/ws-client'
import {
  browserState,
  client,
  current,
  currentLogs,
  isReport,
} from '~/composables/client'
import type { Params } from '~/composables/params'
import { viewMode } from '~/composables/params'
import type { ModuleGraph } from '~/composables/module-graph'
import { getModuleGraph } from '~/composables/module-graph'
import { getProjectNameColor } from '~/utils/task'

const graph = ref<ModuleGraph>({ nodes: [], links: [] })
const draft = ref(false)
const hasGraphBeenDisplayed = ref(false)
const loadingModuleGraph = ref(false)
const currentFilepath = ref<string | undefined>(undefined)

const graphData = computed(() => {
  const c = current.value
  if (!c || !c.filepath) {
    return
  }

  return {
    filepath: c.filepath,
    projectName: c.file.projectName || '',
  }
})

const failedSnapshot = computed(() => {
  return current.value && hasFailedSnapshot(current.value)
})

const isTypecheck = computed(() => {
  return !!current.value?.meta?.typecheck
})

function open() {
  const filePath = current.value?.filepath
  if (filePath) {
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
  }
}

function changeViewMode(view: Params['view']) {
  if (view === 'graph') {
    hasGraphBeenDisplayed.value = true
  }

  viewMode.value = view
}
const consoleCount = computed(() => {
  return currentLogs.value?.reduce((s, { size }) => s + size, 0) ?? 0
})

function onDraft(value: boolean) {
  draft.value = value
}

async function loadModuleGraph() {
  if (
    loadingModuleGraph.value
    || graphData.value?.filepath === currentFilepath.value
  ) {
    return
  }

  loadingModuleGraph.value = true

  await nextTick()

  try {
    const gd = graphData.value
    if (!gd) {
      return
    }

    if (
      !currentFilepath.value
      || gd.filepath !== currentFilepath.value
      || (!graph.value.nodes.length && !graph.value.links.length)
    ) {
      graph.value = getModuleGraph(
        await client.rpc.getModuleGraph(
          gd.projectName,
          gd.filepath,
          !!browserState,
        ),
        gd.filepath,
      )
      currentFilepath.value = gd.filepath
    }
    changeViewMode('graph')
  }
  finally {
    await new Promise(resolve => setTimeout(resolve, 100))
    loadingModuleGraph.value = false
  }
}

debouncedWatch(
  () => [graphData.value, viewMode.value] as const,
  ([, vm]) => {
    if (vm === 'graph') {
      loadModuleGraph()
    }
  },
  { debounce: 100, immediate: true },
)

const projectNameColor = computed(() => {
  return getProjectNameColor(current.value?.file.projectName)
})

const projectNameTextColor = computed(() => {
  switch (projectNameColor.value) {
    case 'blue':
    case 'green':
    case 'magenta':
      return 'white'
    default:
      return 'black'
  }
})
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
        <StatusIcon :state="current.result?.state" :mode="current.mode" :failed-snapshot="failedSnapshot" />
        <div v-if="isTypecheck" v-tooltip.bottom="'This is a typecheck test. It won\'t report results of the runtime tests'" class="i-logos:typescript-icon" flex-shrink-0 />
        <span
          v-if="current?.file.projectName"
          class="rounded-full py-0.5 px-1 text-xs font-light"
          :style="{ backgroundColor: projectNameColor, color: projectNameTextColor }"
        >
          {{ current.file.projectName }}
        </span>
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
          <span class="block w-1.4em h-1.4em i-carbon:report" />
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
          />
          <span
            v-else
            class="block w-1.4em h-1.4em i-carbon:chart-relationship"
          />
          Module Graph
        </button>
        <button
          tab-button
          data-testid="btn-code"
          class="flex items-center gap-2"
          :class="{ 'tab-button-active': viewMode === 'editor' }"
          @click="changeViewMode('editor')"
        >
          <span class="block w-1.4em h-1.4em i-carbon:code" />
          {{ draft ? "*&#160;" : "" }}Code
        </button>
        <button
          tab-button
          data-testid="btn-console"
          class="flex items-center gap-2"
          :class="{
            'tab-button-active': viewMode === 'console',
            'op20': viewMode !== 'console' && consoleCount === 0,
          }"
          @click="changeViewMode('console')"
        >
          <span class="block w-1.4em h-1.4em i-carbon:terminal-3270" />
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
