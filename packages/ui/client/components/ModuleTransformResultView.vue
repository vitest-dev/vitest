<script setup lang="ts">
import type { Editor, EditorFromTextArea, LineWidget, TextMarker } from 'codemirror'
import type { Experimental, ExternalResult, TransformResultWithSource } from 'vitest'
import type { ModuleType } from '~/composables/module-graph'
import { asyncComputed, onKeyStroke } from '@vueuse/core'
import { Tooltip as VueTooltip } from 'floating-vue'
import { join, relative } from 'pathe'
import { computed } from 'vue'
import { browserState, client, config } from '~/composables/client'
import { currentModule } from '~/composables/navigation'
import { formatPreciseTime, formatTime, getDurationClass, getImportDurationType } from '~/utils/task'
import Badge from './Badge.vue'
import CodeMirrorContainer from './CodeMirrorContainer.vue'
import IconButton from './IconButton.vue'

const props = defineProps<{
  id: string
  projectName: string
  type: ModuleType
  canUndo: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'select', id: string, type: ModuleType): void
  (e: 'back'): void
}>()

const result = asyncComputed<TransformResultWithSource | ExternalResult | undefined>(() => {
  if (!currentModule.value?.id) {
    return undefined
  }
  if (props.type === 'inline') {
    return client.rpc.getTransformResult(props.projectName, props.id, currentModule.value.id, !!browserState)
  }
  if (props.type === 'external') {
    return client.rpc.getExternalResult(props.id, currentModule.value.id)
  }
})
const durations = computed(() => {
  const importDurations = currentModule.value?.importDurations || {}
  return importDurations[props.id] || importDurations[join('/@fs/', props.id)] || {}
})
const ext = computed(() => props.id?.split(/\./g).pop() || 'js')

const source = computed(() => result.value?.source?.trim() || '')
const isCached = computed(() => {
  if (!result.value || !('code' in result.value) || !config.value.experimental?.fsModuleCache) {
    return undefined
  }
  const index = result.value.code.lastIndexOf('vitestCache=')
  return index !== -1
})

const code = computed(
  () => {
    if (!result.value || !('code' in result.value)) {
      return null
    }
    return result.value.code
      .replace(/\/\/# sourceMappingURL=.*\n/, '')
      .replace(/\/\/# sourceMappingSource=.*\n/, '')
      .replace(/\/\/# vitestCache=.*\n?/, '')
      .trim() || ''
  },
)
const sourceMap = computed(() => {
  if (!result.value || !('map' in result.value)) {
    return {
      mappings: '',
    }
  }
  return {
    mappings: result.value?.map?.mappings ?? '',
    version: (result.value?.map as any)?.version,
  }
})

const widgetElements: HTMLDivElement[] = []
const markers: TextMarker[] = []
const lineWidgets: LineWidget[] = []

function onMousedown(editor: Editor, e: MouseEvent) {
  const lineCh = editor.coordsChar({ left: e.clientX, top: e.clientY })
  const markers = editor.findMarksAt(lineCh)
  if (markers.length !== 1) {
    return
  }
  const resolvedUrl = markers[0].title
  if (resolvedUrl) {
    const type = markers[0].attributes?.['data-external'] === 'true' ? 'external' : 'inline'
    emit('select', resolvedUrl, type)
  }
}

function buildShadowImportsHtml(imports: Experimental.UntrackedModuleDefinitionDiagnostic[]) {
  const shadowImportsDiv = document.createElement('div')
  shadowImportsDiv.classList.add('mb-5')
  const root = config.value.root
  if (!root) {
    return
  }

  imports.forEach(({ resolvedId, totalTime, external }) => {
    const importDiv = document.createElement('div')
    importDiv.append(document.createTextNode('import '))

    const sourceDiv = document.createElement('span')
    const url = relative(root, resolvedId)
    sourceDiv.textContent = `"/${url}"`
    sourceDiv.className = 'hover:underline decoration-gray cursor-pointer select-none'
    importDiv.append(sourceDiv)
    sourceDiv.addEventListener('click', () => {
      emit('select', resolvedId, external ? 'external' : 'inline')
    })

    const timeElement = document.createElement('span')
    timeElement.textContent = ` ${formatTime(totalTime)}`
    const durationClass = getDurationClass(totalTime)
    if (durationClass) {
      timeElement.classList.add(durationClass)
    }
    importDiv.append(timeElement)

    shadowImportsDiv.append(importDiv)
  })
  return shadowImportsDiv
}

function createDurationDiv(duration: number) {
  const timeElement = document.createElement('div')
  timeElement.className = 'flex ml-2'
  timeElement.textContent = formatTime(duration)
  const durationClass = getDurationClass(duration)
  if (durationClass) {
    timeElement.classList.add(durationClass)
  }
  return timeElement
}

function markImportDurations(codemirror: EditorFromTextArea) {
  lineWidgets.forEach(lw => lw.clear())
  lineWidgets.length = 0

  widgetElements.forEach(el => el.remove())
  widgetElements.length = 0

  markers.forEach(m => m.clear())
  markers.length = 0

  if (result.value && 'modules' in result.value) {
    codemirror.off('mousedown', onMousedown)
    codemirror.on('mousedown', onMousedown)

    const untrackedModules = result.value.untrackedModules

    if (untrackedModules?.length) {
      const importDiv = buildShadowImportsHtml(untrackedModules)
      if (!importDiv) {
        return
      }
      widgetElements.push(importDiv)
      lineWidgets.push(codemirror.addLineWidget(0, importDiv, { above: true }))
    }

    result.value.modules?.forEach((diagnostic) => {
      const start = {
        line: diagnostic.start.line - 1,
        ch: diagnostic.start.column,
      }
      const end = {
        line: diagnostic.end.line - 1,
        ch: diagnostic.end.column,
      }
      const marker = codemirror.markText(start, end, {
        title: diagnostic.resolvedId,
        attributes: {
          'data-external': String(diagnostic.external === true),
        },
        className: 'hover:underline decoration-red cursor-pointer select-none',
      })
      markers.push(marker)
      const timeElement = createDurationDiv(diagnostic.totalTime + (diagnostic.transformTime || 0))
      if (!untrackedModules?.length) {
        timeElement.classList.add('-mt-5')
      }
      widgetElements.push(timeElement)
      codemirror.addWidget(
        {
          line: diagnostic.end.line - 1,
          ch: diagnostic.end.column + 1,
        },
        timeElement,
        false,
      )
    })
  }
}

function goBack() {
  emit('back')
}

onKeyStroke('Escape', () => {
  emit('close')
})
// TODO: sourcemap https://evanw.github.io/source-map-visualization/
</script>

<template>
  <div w-350 max-w-screen h-full flex flex-col>
    <div p-4 relative>
      <div flex justify-between>
        <p>
          <IconButton
            v-if="canUndo"
            v-tooltip.bottom="'Go Back'"
            icon="i-carbon-arrow-left"
            class="flex-inline"
            @click="goBack()"
          />
          Module Info
          <VueTooltip class="inline" cursor-help>
            <Badge type="custom" ml-1 :style="{ backgroundColor: `var(--color-node-${type})` }">
              {{ type }}
            </Badge>
            <template #popper>
              This is module is {{ type === 'external' ? 'externalized' : 'inlined' }}.
              <template v-if="type === 'external'">
                It means that the module was not processed by Vite plugins, but instead was directly imported by the environment.
              </template>
              <template v-else>
                It means that the module was processed by Vite plugins.
              </template>
            </template>
          </VueTooltip>
          <VueTooltip v-if="isCached === true" class="inline" cursor-help>
            <Badge type="tip" ml-2>
              cached
            </Badge>
            <template #popper>
              This module is cached on the file system under `experimental.fsModuleCachePath` ("node_modules/.exprtimental-vitest-cache" by default).
            </template>
          </VueTooltip>
          <VueTooltip v-if="isCached === false" class="inline" cursor-help>
            <Badge type="warning" ml-2>
              not cached
            </Badge>
            <template #popper>
              <p>This module is not cached on the file system. It might be the first test run after cache invalidation or</p>
              <p>it was excluded manually via `experimental_defineCacheKeyGenerator`, or it cannot be cached (modules with `import.meta.glob`, for example).</p>
            </template>
          </VueTooltip>
        </p>
        <div mr-8 flex gap-2 items-center>
          <VueTooltip v-if="durations.selfTime != null && durations.external !== true" class="inline" cursor-help>
            <Badge :type="getImportDurationType(durations.selfTime)">
              self: {{ formatTime(durations.selfTime) }}
            </Badge>
            <template #popper>
              It took {{ formatPreciseTime(durations.selfTime) }} to import this module, excluding static imports.
            </template>
          </VueTooltip>
          <VueTooltip v-if="durations.totalTime != null" class="inline" cursor-help>
            <Badge :type="getImportDurationType(durations.totalTime)">
              total: {{ formatTime(durations.totalTime) }}
            </Badge>
            <template #popper>
              It took {{ formatPreciseTime(durations.totalTime) }} to import the whole module, including static imports.
            </template>
          </VueTooltip>
          <VueTooltip v-if="result && 'transformTime' in result && result.transformTime" class="inline" cursor-help>
            <Badge :type="getImportDurationType(result.transformTime)">
              transform: {{ formatTime(result.transformTime) }}
            </Badge>
            <template #popper>
              It took {{ formatPreciseTime(result.transformTime) }} to transform this module by Vite plugins.
            </template>
          </VueTooltip>
        </div>
      </div>
      <p op50 font-mono text-sm>
        {{ id }}
      </p>
      <IconButton
        icon="i-carbon-close"
        absolute
        top-5px
        right-5px
        text-2xl
        @click="emit('close')"
      />
    </div>
    <div v-if="!result" p-5>
      No transform result found for this module.
    </div>
    <template v-else>
      <div grid="~ rows-[min-content_auto]" overflow-hidden flex-auto :class="{ 'cols-2': code != null }">
        <div p="x3 y-1" bg-overlay border="base b t r">
          Source
        </div>
        <div v-if="code != null" p="x3 y-1" bg-overlay border="base b t">
          Transformed
        </div>
        <CodeMirrorContainer
          :key="id"
          h-full
          :model-value="source"
          read-only
          v-bind="{ lineNumbers: true }"
          :mode="ext"
          @codemirror="markImportDurations($event)"
        />
        <CodeMirrorContainer
          v-if="code != null"
          h-full
          :model-value="code"
          read-only
          v-bind="{ lineNumbers: true }"
          mode="js"
        />
      </div>
      <div v-if="sourceMap.mappings !== ''">
        <div p="x3 y-1" bg-overlay border="base b t">
          Source map (v{{ sourceMap.version }})
        </div>
        <CodeMirrorContainer
          :model-value="sourceMap.mappings"
          read-only
          v-bind="{ lineNumbers: true }"
        />
      </div>
    </template>
  </div>
</template>
