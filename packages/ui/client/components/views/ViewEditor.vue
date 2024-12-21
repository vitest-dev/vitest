<script setup lang="ts">
import type CodeMirror from 'codemirror'
import type { ErrorWithDiff, File } from 'vitest'
import { createTooltip, destroyTooltip } from 'floating-vue'
import { client, isReport } from '~/composables/client'
import { finished } from '~/composables/client/state'
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
const saving = ref(false)
const currentPosition = ref<CodeMirror.Position | undefined>()

watch(
  () => props.file,
  async () => {
    // this watcher will be called multiple times when saving the file in the view editor
    // since we are saving the file and changing the content inside onSave we just return here
    if (saving.value) {
      return
    }
    loading.value = true
    try {
      if (!props.file || !props.file?.filepath) {
        code.value = ''
        serverCode.value = code.value
        draft.value = false
        loading.value = false
        return
      }

      code.value = (await client.rpc.readTestFile(props.file.filepath)) || ''
      serverCode.value = code.value
      draft.value = false
    }
    catch (e) {
      console.error('cannot fetch file', e)
    }

    await nextTick()

    // fire focusing editor after loading
    loading.value = false
  },
  { immediate: true },
)

watch(() => [loading.value, saving.value, props.file, lineNumber.value] as const, ([loadingFile, s, _, l]) => {
  if (!loadingFile && !s) {
    if (l != null) {
      nextTick(() => {
        const cp = currentPosition.value
        const line = cp ?? { line: l ?? 0, ch: 0 }
        // restore caret position: the watchDebounced below will use old value
        if (cp) {
          currentPosition.value = undefined
        }
        else {
          codemirrorRef.value?.scrollIntoView(line, 100)
          nextTick(() => {
            codemirrorRef.value?.focus()
            codemirrorRef.value?.setCursor(line)
          })
        }
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
  span.addEventListener('click', el)
  div.appendChild(span)
  listeners.push([span, el, () => destroyTooltip(span)])
  handles.push(codemirrorRef.value!.addLineClass(stack.line - 1, 'wrap', 'bg-red-500/10'))
  widgets.push(codemirrorRef.value!.addLineWidget(stack.line - 1, div))
}

const { pause, resume } = watch(
  [codemirrorRef, failed, finished] as const,
  ([cmValue, f, end]) => {
    if (!cmValue) {
      widgets.length = 0
      handles.length = 0
      clearListeners()
      return
    }

    // if still running
    if (!end) {
      return
    }

    // cleanup previous data when not saving just reloading
    cmValue.off('changes', codemirrorChanges)

    // cleanup previous data
    clearListeners()
    widgets.forEach(widget => widget.clear())
    handles.forEach(h => cmValue?.removeLineClass(h, 'wrap'))
    widgets.length = 0
    handles.length = 0

    setTimeout(() => {
      // add new data
      f.forEach((i) => {
        i.result?.errors?.forEach(createErrorElement)
      })

      // Prevent getting access to initial state
      if (!hasBeenEdited.value) {
        cmValue.clearHistory()
      }

      cmValue.on('changes', codemirrorChanges)
    }, 100)
  },
  { flush: 'post' },
)

watchDebounced(() => [finished.value, saving.value, currentPosition.value] as const, ([f, s], old) => {
  if (f && !s && old && old[2]) {
    codemirrorRef.value?.setCursor(old[2])
  }
}, { debounce: 100, flush: 'post' })

async function onSave(content: string) {
  if (saving.value) {
    return
  }
  pause()
  saving.value = true
  await nextTick()

  // clear previous state
  const cmValue = codemirrorRef.value
  if (cmValue) {
    cmValue.setOption('readOnly', true)
    await nextTick()
    cmValue.refresh()
  }
  // save cursor position
  currentPosition.value = cmValue?.getCursor()
  cmValue?.off('changes', codemirrorChanges)

  // cleanup previous data
  clearListeners()
  widgets.forEach(widget => widget.clear())
  handles.forEach(h => cmValue?.removeLineClass(h, 'wrap'))
  widgets.length = 0
  handles.length = 0

  try {
    hasBeenEdited.value = true
    // save the file changes
    await client.rpc.saveTestFile(props.file!.filepath, content)
    // update original server code
    serverCode.value = content
    // update draft indicator in the tab title (</> * Code)
    draft.value = false
  }
  catch (e) {
    console.error('error saving file', e)
  }

  // Prevent getting access to initial state
  if (!hasBeenEdited.value) {
    cmValue?.clearHistory()
  }

  try {
    // the server will send a few events in a row
    // await to re-run test
    await until(finished).toBe(false, { flush: 'sync', timeout: 1000, throwOnTimeout: true })
    // await to finish
    await until(finished).toBe(true, { flush: 'sync', timeout: 1000, throwOnTimeout: false })
  }
  catch {
    // ignore errors
  }

  // add new data
  failed.value.forEach((i) => {
    i.result?.errors?.forEach(createErrorElement)
  })

  cmValue?.on('changes', codemirrorChanges)

  saving.value = false
  await nextTick()
  if (cmValue) {
    cmValue.setOption('readOnly', false)
    await nextTick()
    cmValue.refresh()
  }
  // activate watcher
  resume()
}

// we need to remove listeners before unmounting the component: the watcher will not be called
onBeforeUnmount(clearListeners)
</script>

<template>
  <CodeMirrorContainer
    ref="editor"
    v-model="code"
    h-full
    v-bind="{ lineNumbers: true, readOnly: isReport, saving }"
    :mode="ext"
    data-testid="code-mirror"
    @save="onSave"
  />
</template>
