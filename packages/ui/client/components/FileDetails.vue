<script setup lang="ts">
import type { ModuleGraphData } from 'vitest'
import { client, current, currentLogs, isReport } from '~/composables/client'
import type { Params } from '~/composables/params'
import { viewMode } from '~/composables/params'
import type { ModuleGraph } from '~/composables/module-graph'
import { getModuleGraph } from '~/composables/module-graph'

const data = ref<ModuleGraphData>({ externalized: [], graph: {}, inlined: [] })
const graph = ref<ModuleGraph>({ nodes: [], links: [] })
const draft = ref(false)
const hasGraphBeenDisplayed = ref(false)

debouncedWatch(
  current,
  async (c, o) => {
    if (c && c.filepath !== o?.filepath) {
      data.value = await client.rpc.getModuleGraph(c.filepath)
      graph.value = getModuleGraph(data.value, c.filepath)
    }
  },
  { debounce: 100, immediate: true },
)

function open() {
  const filePath = current.value?.filepath
  if (filePath)
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
}

function changeViewMode(view: Params['view']) {
  if (view === 'graph')
    hasGraphBeenDisplayed.value = true

  viewMode.value = view
}
const consoleCount = computed(() => {
  return currentLogs.value?.reduce((s, { size }) => s + size, 0) ?? 0
})

function onDraft(value: boolean) {
  draft.value = value
}
</script>

<template>
  <div v-if="current" flex flex-col h-full max-h-full overflow-hidden data-testid="file-detail">
    <div>
      <div p="2" h-10 flex="~ gap-2" items-center bg-header border="b base">
        <StatusIcon :task="current" />
        <div flex-1 font-light op-50 ws-nowrap truncate text-sm>
          {{ current?.filepath }}
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
          :class="{ 'tab-button-active': viewMode == null }"
          data-testid="btn-report"
          @click="changeViewMode(null)"
        >
          Report
        </button>
        <button
          tab-button
          data-testid="btn-graph"
          :class="{ 'tab-button-active': viewMode === 'graph' }"
          @click="changeViewMode('graph')"
        >
          Module Graph
        </button>
        <button
          v-if="!isReport"
          tab-button
          data-testid="btn-code"
          :class="{ 'tab-button-active': viewMode === 'editor' }"
          @click="changeViewMode('editor')"
        >
          {{ draft ? '*&#160;' : '' }}Code
        </button>
        <button
          tab-button
          data-testid="btn-console"
          :class="{ 'tab-button-active': viewMode === 'console', 'op20': viewMode !== 'console' && consoleCount === 0 }"
          @click="changeViewMode('console')"
        >
          Console ({{ consoleCount }})
        </button>
      </div>
    </div>

    <div flex flex-col flex-1 overflow="hidden">
      <div v-if="hasGraphBeenDisplayed" :flex-1="viewMode === 'graph' && ''">
        <ViewModuleGraph v-show="viewMode === 'graph'" :graph="graph" data-testid="graph" />
      </div>
      <ViewEditor v-if="viewMode === 'editor'" :key="current.filepath" :file="current" data-testid="editor" @draft="onDraft" />
      <ViewConsoleOutput v-else-if="viewMode === 'console'" :file="current" data-testid="console" />
      <ViewReport v-else-if="!viewMode" :file="current" data-testid="report" />
    </div>
  </div>
</template>
