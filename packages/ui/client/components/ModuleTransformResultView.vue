<script setup lang="ts">
import { client } from '~/composables/client'
const props = defineProps<{ id: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const result = asyncComputed(() => client.rpc.getTransformResult(props.id))
const ext = computed(() => props.id?.split(/\./g).pop() || 'js')

const source = computed(() => result.value?.source?.trim() || '')
const code = computed(() => result.value?.code?.replace(/\/\/# sourceMappingURL=.*\n/, '').trim() || '')
const sourceMap = computed(() => ({
  mappings: result.value?.map?.mappings ?? '',
  version: result.value?.map?.version,
}))

onKeyStroke('Escape', () => {
  emit('close')
})
// TODO: sourcemap https://evanw.github.io/source-map-visualization/
</script>

<template>
  <div w-350 max-w-screen>
    <div p-4 relative>
      <p>Module Info</p>
      <p op50 font-mono text-sm>
        {{ id }}
      </p>
      <IconButton icon="i-carbon-close" absolute top-5px right-5px text-2xl @click="emit('close')" />
    </div>
    <div v-if="!result" p-5>
      No transform result found for this module.
    </div>
    <template v-else>
      <div grid="~ cols-2" overflow-hidden>
        <div p="x3 y-1" bg-overlay border="base b t r">
          Source
        </div>
        <div p="x3 y-1" bg-overlay border="base b t">
          Transformed
        </div>
        <div>
          <CodeMirror :model-value="source" read-only v-bind="{ lineNumbers: true }" :mode="ext" />
        </div>
        <div>
          <CodeMirror :model-value="code" read-only v-bind="{ lineNumbers: true }" :mode="ext" />
        </div>
      </div>
      <template v-if="sourceMap.mappings !== ''">
        <div p="x3 y-1" bg-overlay border="base b t">
          Source map (v{{ sourceMap.version }})
        </div>
        <CodeMirror
          :model-value="sourceMap.mappings"
          read-only
          v-bind="{ lineNumbers: true }"
          :mode="ext"
        />
      </template>
    </template>
  </div>
</template>
