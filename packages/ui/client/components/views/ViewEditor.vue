<script setup lang="ts">
import type CodeMirror from 'codemirror'
import type { ErrorWithDiff, File } from 'vitest'
import { createTooltip, destroyTooltip } from 'floating-vue'
import { client, isReport } from '~/composables/client'
import { codemirrorRef } from '~/composables/codemirror'
import { openInEditor } from '~/composables/error'
import { lineNumber } from '~/composables/params'

const props = defineProps<{
  file?: File
}>()

const emit = defineEmits<{ (event: 'draft', value: boolean): void }>()

const code = ref('')
const serverCode = shallowRef<string | undefined>(undefined)
const draft = ref(false)
const loading = ref(true)

watch(
  () => props.file,
  async () => {
    loading.value = true
    try {
      if (!props.file || !props.file?.filepath) {
        code.value = ''
        serverCode.value = code.value
        draft.value = false
        return
      }

      code.value = (await client.rpc.readTestFile(props.file.filepath)) || ''
      serverCode.value = code.value
      draft.value = false
    }
    finally {
      // fire focusing editor after loading
      nextTick(() => (loading.value = false))
    }
  },
  { immediate: true },
)

watch(() => [loading.value, props.file, lineNumber.value] as const, ([loadingFile, _, l]) => {
  if (!loadingFile) {
    if (l != null) {
      nextTick(() => {
        const line = { line: l ?? 0, ch: 0 }
        codemirrorRef.value?.scrollIntoView(line, 100)
        nextTick(() => {
          codemirrorRef.value?.focus()
          codemirrorRef.value?.setCursor(line)
        })
      })
    }
    else {
      nextTick(() => {
        codemirrorRef.value?.focus()
      })
    }
  }
}, { flush: 'post' })

const ext = computed(() => props.file?.filepath?.split(/\./g).pop() || 'js')
const editor = ref<any>()

const cm = computed<CodeMirror.EditorFromTextArea | undefined>(
  () => editor.value?.cm,
)
const failed = computed(
  () => props.file?.tasks.filter(i => i.result?.state === 'fail') || [],
)

const widgets: CodeMirror.LineWidget[] = []
const handles: CodeMirror.LineHandle[] = []
const listeners: [el: HTMLSpanElement, l: EventListener, t: () => void][] = []

const hasBeenEdited = ref(false)

function clearListeners() {
  listeners.forEach(([el, l, t]) => {
    el.removeEventListener('click', l)
    t()
  })
  listeners.length = 0
}

useResizeObserver(editor, () => {
  codemirrorRef.value?.refresh()
})

function codemirrorChanges() {
  draft.value = serverCode.value !== codemirrorRef.value!.getValue()
}

watch(
  draft,
  (d) => {
    emit('draft', d)
  },
  { immediate: true },
)

function createErrorElement(e: ErrorWithDiff) {
  const stacks = (e?.stacks || []).filter(
    i => i.file && i.file === props.file?.filepath,
  )
  const stack = stacks?.[0]
  if (!stack) {
    return
  }
  const div = document.createElement('div')
  div.className = 'op80 flex gap-x-2 items-center'
  const pre = document.createElement('pre')
  pre.className = 'c-red-600 dark:c-red-400'
  pre.textContent = `${' '.repeat(stack.column)}^ ${e?.nameStr || e.name}: ${
    e?.message || ''
  }`
  div.appendChild(pre)
  const span = document.createElement('span')
  span.className
    = 'i-carbon-launch c-red-600 dark:c-red-400 hover:cursor-pointer min-w-1em min-h-1em'
  span.tabIndex = 0
  span.ariaLabel = 'Open in Editor'
  createTooltip(
    span,
    {
      content: 'Open in Editor',
      placement: 'bottom',
    },
    false,
  )
  const el: EventListener = async () => {
    await openInEditor(stack.file, stack.line, stack.column)
  }
  div.appendChild(span)
  listeners.push([span, el, () => destroyTooltip(span)])
  handles.push(codemirrorRef.value!.addLineClass(stack.line - 1, 'wrap', 'bg-red-500/10'))
  widgets.push(codemirrorRef.value!.addLineWidget(stack.line - 1, div))
}

watch(
  [cm, failed],
  ([cmValue]) => {
    if (!cmValue) {
      clearListeners()
      return
    }

    setTimeout(() => {
      clearListeners()
      widgets.forEach(widget => widget.clear())
      handles.forEach(h => codemirrorRef.value?.removeLineClass(h, 'wrap'))
      widgets.length = 0
      handles.length = 0

      cmValue.on('changes', codemirrorChanges)

      failed.value.forEach((i) => {
        i.result?.errors?.forEach(createErrorElement)
      })
      if (!hasBeenEdited.value) {
        cmValue.clearHistory()
      } // Prevent getting access to initial state
    }, 100)
  },
  { flush: 'post' },
)

async function onSave(content: string) {
  hasBeenEdited.value = true
  await client.rpc.saveTestFile(props.file!.filepath, content)
  serverCode.value = content
  draft.value = false
}
</script>

<template>
  <CodeMirrorContainer
    ref="editor"
    v-model="code"
    h-full
    v-bind="{ lineNumbers: true, readOnly: isReport }"
    :mode="ext"
    data-testid="code-mirror"
    @save="onSave"
  />
</template>
