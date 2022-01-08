<script setup lang="ts">
import type CodeMirror from 'codemirror'
import { client } from '~/composables/client'
import type { File } from '#types'

const props = defineProps<{
  file?: File
  headerSize: number
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

const style = computed(() => {
  const size = props.headerSize
  return size > 0 ? `--cm-scrolls-height: calc(100vh - ${size}px - 1px)` : null
})

const widgets: CodeMirror.LineWidget[] = []
const handles: CodeMirror.LineHandle[] = []

async function onSave(content: string) {
  await client.rpc.writeFile(props.file!.filepath, content)
}

watch([cm, failed], () => {
  if (!cm.value)
    return

  setTimeout(() => {
    widgets.forEach(widget => widget.clear())
    handles.forEach(h => cm.value?.removeLineClass(h, 'wrap'))
    widgets.length = 0
    handles.length = 0

    failed.value.forEach((i) => {
      const e = i.result?.error
      const stacks = (e?.stacks || []).filter(i => i.file && i.file === props.file?.filepath)
      if (stacks.length) {
        const pos = stacks[0].sourcePos || stacks[0]
        const el = document.createElement('pre')
        el.className = 'c-red-600 dark:c-red-400'
        el.textContent = `${' '.repeat(pos.column)}^ ${e?.nameStr}: ${e?.message}`
        handles.push(cm.value!.addLineClass(pos.line - 1, 'wrap', 'bg-red-500/10'))
        widgets.push(cm.value!.addLineWidget(pos.line - 1, el))
      }
    })
  }, 100)
}, { flush: 'post' })
</script>

<template>
  <CodeMirror
    ref="editor"
    v-model="code"
    v-bind="{ lineNumbers: true }"
    :mode="ext"
    :style="style"
    @save="onSave"
  />
</template>
