<script setup lang="ts">
import type { ExternalResult, TransformResultWithSource } from 'vitest'
import type { ModuleType } from '~/composables/module-graph'
import { asyncComputed, onKeyStroke } from '@vueuse/core'
import { Tooltip as VueTooltip } from 'floating-vue'
import { join } from 'pathe'
import { computed } from 'vue'
import { browserState, client } from '~/composables/client'
import { currentModule } from '~/composables/navigation'
import { formatPreciseTime, formatTime, getImportDurationType } from '~/utils/task'
import Badge from './Badge.vue'
import CodeMirrorContainer from './CodeMirrorContainer.vue'
import IconButton from './IconButton.vue'

const props = defineProps<{
  id: string
  projectName: string
  type: ModuleType
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

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
  if (!result.value || !('code' in result.value)) {
    return false
  }
  const index = result.value.code.lastIndexOf('vitestCache=')
  return index !== -1
})

// TODO: parse modules and make it clickable
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
          <VueTooltip v-if="isCached" class="inline" cursor-help>
            <Badge type="tip" ml-2>
              cached
            </Badge>
            <template #popper>
              This module is cached on the file system under `experimental.fsModuleCachePath` ("node_modules/.exprtimental-vitest-cache" by default).
            </template>
          </VueTooltip>
        </p>
        <div mr-8 flex gap-2 items-center>
          <VueTooltip v-if="durations.selfTime != null" class="inline" cursor-help>
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
          h-full
          :model-value="source"
          read-only
          v-bind="{ lineNumbers: true }"
          :mode="ext"
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
