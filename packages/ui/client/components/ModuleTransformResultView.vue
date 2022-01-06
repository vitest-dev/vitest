<script setup lang="ts">import { client } from '~/composables/client'
const props = defineProps<{ id: string }>()
const result = await client.rpc.getTransformResult(props.id)
const ext = computed(() => props.id?.split(/\./g).pop() || 'js')

const source = computed(() => result?.source?.trim() || '')
const code = computed(() => result?.code?.replace(/\/\/# sourceMappingURL=.*\n/, '').trim() || '')
// TODO: sourcemap https://evanw.github.io/source-map-visualization/
</script>

<template>
  <div w-350 max-w-screen>
    <div p-4 relative>
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
        <div p="x3 y-1" bg-overlay border="base b t">
          Transformed
        </div>
        <div>
          <CodeMirror :model-value="source" v-bind="{ lineNumbers:true }" :mode="ext" />
        </div>
        <div>
          <CodeMirror :model-value="code" v-bind="{ lineNumbers:true }" :mode="ext" />
        </div>
      </div>
      <pre>{{ result }}</pre>
    </template>
  </div>
</template>
