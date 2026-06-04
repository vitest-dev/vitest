<script setup lang="ts">
import type { RunnerTask, RunnerTestCase } from 'vitest'
import type { Params } from '~/composables/params'
import { computed, ref } from 'vue'
import DetailsHeaderButtons from '~/components/DetailsHeaderButtons.vue'
import {
  browserState,
  client,
  current,
  currentLogs,
  isReport,
} from '~/composables/client'
import { tagsDefinitions } from '~/composables/client/state'
import { explorerTree } from '~/composables/explorer'
import { hasFailedSnapshot } from '~/composables/explorer/collector'
import { selectedTest, viewMode } from '~/composables/params'
import { getBadgeNameColor, getBadgeTextColor } from '~/utils/task'
import FileDetailsModuleGraph from './FileDetailsModuleGraph.vue'
import IconButton from './IconButton.vue'
import StatusIcon from './StatusIcon.vue'
import ViewConsoleOutput from './views/ViewConsoleOutput.vue'
import ViewEditor from './views/ViewEditor.vue'
import ViewReport from './views/ViewReport.vue'
import ViewTestReport from './views/ViewTestReport.vue'

const draft = ref(false)

const test = computed(() => {
  return selectedTest.value
    ? client.state.idMap.get(selectedTest.value) as RunnerTestCase
    : undefined
})

const failedSnapshot = computed(() => {
  return current.value && hasFailedSnapshot(current.value)
})

const isTypecheck = computed(() => {
  return !!current.value?.meta?.typecheck
})

const label = computed(() => current.value?.meta?.__vitest_label__)

function open() {
  const filePath = current.value?.filepath
  if (filePath) {
    fetch(`/__open-in-editor?file=${encodeURIComponent(filePath)}`)
  }
}

function changeViewMode(view: Params['view']) {
  viewMode.value = view
}
const consoleCount = computed(() => {
  return currentLogs.value?.reduce((s, { size }) => s + size, 0) ?? 0
})

function onDraft(value: boolean) {
  draft.value = value
}

const projectName = computed(() => current.value?.file.projectName || '')
const projectNameColor = computed(() => {
  const projectNameValue = projectName.value
  return explorerTree.colors.get(projectNameValue) || getBadgeNameColor(projectNameValue)
})

const projectNameTextColor = computed(() => getBadgeTextColor(projectNameColor.value))

const testTitle = computed(() => {
  const testId = selectedTest.value
  if (!testId) {
    return current.value?.name
  }
  const names: string[] = []
  let node: RunnerTask | undefined = client.state.idMap.get(testId)
  while (node) {
    names.push(node.name)
    node = node.suite
  }
  return names.reverse().join(' > ')
})

const tags = computed(() => {
  const testId = selectedTest.value
  if (!testId) {
    return []
  }
  const node = client.state.idMap.get(testId)
  return (node?.tags || []).map(tag => ({
    name: tag,
    description: tagsDefinitions.value[tag]?.description,
    bg: getBadgeNameColor(tag, true),
    border: getBadgeNameColor(tag),
    text: 'white',
  }))
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
        <span v-if="label" class="rounded-sm px-1 text-xs font-light bg-cyan-500/20 text-cyan-700 dark:text-cyan-300" flex-shrink-0>{{ label }}</span>
        <span
          v-if="current?.file.projectName"
          class="rounded-full py-0.5 px-2 text-xs font-light"
          :style="{ backgroundColor: projectNameColor, color: projectNameTextColor }"
          cursor-default
        >
          {{ current.file.projectName }}
        </span>
        <div flex-1 font-light overflow-hidden text-sm flex>
          <span op-50 truncate>
            {{ testTitle }}
          </span>

          <span
            v-for="tag of tags"
            :key="tag.name"
            v-tooltip.bottom="tag.description"
            class="rounded-full ml-2 px-2 text-xs font-light"
            :style="{ backgroundColor: tag.bg, color: tag.text, border: `1px solid ${tag.border}` }"
            :title="tag.description"
            cursor-default
            flex
            items-center
          >
            {{ tag.name }}
          </span>
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
          <DetailsHeaderButtons v-if="browserState" />
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
          <span class="block w-1.4em h-1.4em i-carbon:chart-relationship" />
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
      <FileDetailsModuleGraph
        v-if="viewMode === 'graph'"
        :key="`graph:${current.id}`"
        :file="current"
        :project-name="projectName"
      />
      <ViewEditor
        v-else-if="viewMode === 'editor'"
        :key="`editor:${current.id}`"
        :file="current"
        data-testid="editor"
        @draft="onDraft"
      />
      <ViewConsoleOutput
        v-else-if="viewMode === 'console'"
        :file="current"
        data-testid="console"
      />
      <ViewReport v-else-if="!viewMode && !test && current" :file="current" data-testid="report" />
      <ViewTestReport v-else-if="!viewMode && test" :test="test" data-testid="report" />
    </div>
  </div>
</template>
