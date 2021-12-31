<script setup lang="ts">
import { client } from '~/composables/client'
import type { File } from '#types'

const props = defineProps<{
  file?: File
}>()

const code = ref('')
watch(() => props.file,
  async() => {
    if (!props.file || !props.file?.filepath) {
      code.value = ''
      return
    }
    code.value = await client.rpc.getSourceCode(props.file.filepath)
  },
  { immediate: true },
)
const ext = computed(() => props.file?.filepath?.split(/\./g).pop() || 'js')
</script>

<template>
  <CodeMirror
    v-model="code"
    v-bind="{ lineNumbers: true }"
    :read-only="true"
    :mode="ext"
  />
</template>
