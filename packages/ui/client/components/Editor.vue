<script setup lang="ts">
import { client, current } from '~/composables/client'

const code = ref('')
watch(current, async() => {
  if (!current.value || !current.value.filepath) {
    code.value = ''
    return
  }
  code.value = await client.rpc.getSourceCode(current.value.filepath)
}, { immediate: true })
const ext = computed(() => current.value?.filepath?.split(/\./g).pop() || 'js')
</script>

<template>
  <CodeMirror
    v-model="code"
    v-bind="{ lineNumbers: true }"
    :read-only="true"
    :mode="ext"
  />
</template>
