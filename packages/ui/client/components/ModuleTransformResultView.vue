<script setup lang="ts">
import { asyncComputed, onKeyStroke } from '@vueuse/core'
import { computed } from 'vue'
import { browserState, client } from '~/composables/client'
import { currentModule } from '~/composables/navigation'
import CodeMirrorContainer from './CodeMirrorContainer.vue'
import IconButton from './IconButton.vue'

const props = defineProps<{ id: string; projectName: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const result = asyncComputed(() =>
  client.rpc.getTransformResult(props.projectName, props.id, currentModule.value?.id, !!browserState),
)
const ext = computed(() => props.id?.split(/\./g).pop() || 'js')

const source = computed(() => result.value?.source?.trim() || '')
const isCached = computed(() => {
  const index = result.value?.code.lastIndexOf('vitestCache=')
  return index !== -1
})

// TODO: parse modules and make it clickable
const code = computed(
  () =>
    result.value?.code
      ?.replace(/\/\/# sourceMappingURL=.*\n/, '')
      .replace(/\/\/# sourceMappingSource=.*\n/, '')
      .replace(/\/\/# vitestCache=.*\n?/, '')
      .trim() || '',
)
const sourceMap = computed(() => ({
  mappings: result.value?.map?.mappings ?? '',
  version: (result.value?.map as any)?.version,
}))

onKeyStroke('Escape', () => {
  emit('close')
})

// TODO: to utils
function formatTime(time: number): string {
  if (time > 1000) {
    return `${(time / 1000).toFixed(2)}s`
  }
  return `${Math.round(time)}ms`
}
// TODO: sourcemap https://evanw.github.io/source-map-visualization/
</script>

<template>
  <div w-350 max-w-screen h-full flex flex-col>
    <div p-4 relative>
      <p>
        Module Info
        <!-- TODO: badge component -->
        <span v-if="isCached" class="absolute rounded-full py-0.5 px-2 ml-2 text-xs" bg-orange>
          cached
        </span>
      </p>
      <p op50 font-mono text-sm>
        {{ id }}
        <!-- TODO: component? -->
        <span
          v-if="result?.selfTime != null"
          :class="{
            'text-red': result.selfTime >= 500,
            'text-orange': result.selfTime >= 100 && result.selfTime < 500,
          }"
        >
          (self: {{ formatTime(result.selfTime) }},
        </span>
        <span
          v-if="result?.totalTime != null"
          :class="{
            'text-red': result.totalTime >= 500,
            'text-orange': result.totalTime >= 100 && result.totalTime < 500,
          }"
        >
          total: {{ formatTime(result.totalTime) }})
        </span>
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
      <div grid="~ cols-2 rows-[min-content_auto]" overflow-hidden flex-auto>
        <div p="x3 y-1" bg-overlay border="base b t r">
          Source
        </div>
        <div p="x3 y-1" bg-overlay border="base b t">
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
          h-full
          :model-value="code"
          read-only
          v-bind="{ lineNumbers: true }"
          :mode="ext"
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
          :mode="ext"
        />
      </div>
    </template>
  </div>
</template>
