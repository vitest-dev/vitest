<script setup lang="ts">
import { client } from '~/composables/client'
const props = defineProps<{ id: string }>()
defineEmits<{ (e: 'close'): void }>()

const result = asyncComputed(() => client.rpc.getTransformResult(props.id))
const ext = computed(() => props.id?.split(/\./g).pop() || 'js')

const source = computed(() => result.value?.source?.trim() || '')
const code = computed(() => result.value?.code?.replace(/\/\/# sourceMappingURL=.*\n/, '').trim() || '')
// TODO: sourcemap https://evanw.github.io/source-map-visualization/

const header = ref(null)
const header2 = ref(null)
const headerSize = ref(0)
const header2Size = ref(0)
useResizeObserver(header, () => {
  const clientHeight = unrefElement(header)?.clientHeight
  headerSize.value = clientHeight ?? 0
})
useResizeObserver(header2, () => {
  const clientHeight = unrefElement(header2)?.clientHeight
  header2Size.value = clientHeight ?? 0
})
const style = computed(() => {
  const size = headerSize.value + header2Size.value
  return size > 0 ? `--cm-scrolls-mod-info: calc(100vh - ${size + 3}px)` : null
})
</script>

<template>
  <div w-350 max-w-screen>
    <div ref="header" p-4 relative>
      <p>Module Info</p>
      <p op50 font-mono text-sm>
        {{ id }}
      </p>
      <IconButton absolute top-5px right-5px icon="i-carbon-close" text-2xl @click="$emit('close')" />
    </div>
    <div v-if="!result" p-5>
      No transform result found for this module.
    </div>
    <template v-else>
      <div grid="~ cols-2" overflow-hidden>
        <div p="x3 y-1" bg-overlay border="base b t r">
          Source
        </div>
        <div ref="header2" p="x3 y-1" bg-overlay border="base b t">
          Transformed
        </div>
        <div>
          <CodeMirror :model-value="source" v-bind="{ lineNumbers:true }" :mode="ext" :style="style" />
        </div>
        <div>
          <CodeMirror :model-value="code" v-bind="{ lineNumbers:true }" :mode="ext" :style="style" />
        </div>
      </div>
      <pre>{{ result }}</pre>
    </template>
  </div>
</template>
