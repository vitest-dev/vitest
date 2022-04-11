<script setup lang="ts">
import type CodeMirror from 'codemirror'
import { createTooltip, destroyTooltip } from 'floating-vue'
import { openInEditor } from '../../composables/error'
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

const widgets: CodeMirror.LineWidget[] = []
const handles: CodeMirror.LineHandle[] = []
const listeners: [el: HTMLSpanElement, l: EventListener, t: () => void][] = []

const hasBeenEdited = ref(false)

const clearListeners = () => {
  listeners.forEach(([el, l, t]) => {
    el.removeEventListener('click', l)
    t()
  })
  listeners.length = 0
}

useResizeObserver(editor, () => {
  cm.value?.refresh()
})

watch([cm, failed], () => {
  if (!cm.value) {
    clearListeners()
    return
  }

  setTimeout(() => {
    clearListeners()
    widgets.forEach(widget => widget.clear())
    handles.forEach(h => cm.value?.removeLineClass(h, 'wrap'))
    widgets.length = 0
    handles.length = 0

    failed.value.forEach((i) => {
      const e = i.result?.error
      const stacks = (e?.stacks || []).filter(i => i.file && i.file === props.file?.filepath)
      if (stacks.length) {
        const pos = stacks[0].sourcePos || stacks[0]
        const div = document.createElement('div')
        div.className = 'op80 flex gap-x-2 items-center'
        const pre = document.createElement('pre')
        pre.className = 'c-red-600 dark:c-red-400'
        pre.textContent = `${' '.repeat(pos.column)}^ ${e?.nameStr}: ${e?.message}`
        div.appendChild(pre)
        const span = document.createElement('span')
        span.className = 'i-carbon-launch c-red-600 dark:c-red-400 hover:cursor-pointer min-w-1em min-h-1em'
        span.tabIndex = 0
        span.ariaLabel = 'Open in Editor'
        const tooltip = createTooltip(span, {
          content: 'Open in Editor',
          placement: 'bottom',
        }, false)
        const el: EventListener = async() => {
          await openInEditor(stacks[0].file, pos.line, pos.column)
        }
        div.appendChild(span)
        listeners.push([span, el, () => destroyTooltip(span)])
        handles.push(cm.value!.addLineClass(pos.line - 1, 'wrap', 'bg-red-500/10'))
        widgets.push(cm.value!.addLineWidget(pos.line - 1, div))
      }
    })
    if (!hasBeenEdited.value)
      cm.value?.clearHistory() // Prevent getting access to initial state
  }, 100)
}, { flush: 'post' })

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
    data-testid="code-mirror"
    @save="onSave"
  />
</template>
