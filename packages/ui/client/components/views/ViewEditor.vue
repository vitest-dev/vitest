<script setup lang="ts">
import type CodeMirror from 'codemirror'
import { useCodeError } from '../../composables/error'
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
    code.value = await client.rpc.readFile(props.file.filepath)
  },
  { immediate: true },
)
const ext = computed(() => props.file?.filepath?.split(/\./g).pop() || 'js')
const editor = ref<any>()

const cm = computed<CodeMirror.EditorFromTextArea | undefined>(() => editor.value?.cm)
const failed = computed(() => props.file?.tasks.filter(i => i.result?.state === 'fail') || [])

const { hasBeenEdited } = useCodeError(props, cm, failed)

async function onSave(content: string) {
  hasBeenEdited.value = true
  await client.rpc.writeFile(props.file!.filepath, content)
}
</script>

<template>
  <CodeMirror
    ref="editor"
    v-model="code"
    h-full
    v-bind="{ lineNumbers: true }"
    :mode="ext"
    @save="onSave"
  />
</template>
