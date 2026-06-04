<script setup lang="ts">
import type CodeMirror from 'codemirror'
import type { RunnerTestFile, RunnerTask as Task, TestAnnotation, TestError } from 'vitest'
import { until, useResizeObserver, watchDebounced } from '@vueuse/core'
import { createTooltip, destroyTooltip } from 'floating-vue'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { getAttachmentUrl, sanitizeFilePath } from '~/composables/attachments'
import { client, config, isReport } from '~/composables/client'
import { finished } from '~/composables/client/state'
import { codemirrorRef } from '~/composables/codemirror'
import { isDark } from '~/composables/dark'
import { createAnsiToHtmlFilter, openInEditor } from '~/composables/error'
import { columnNumber, lineNumber } from '~/composables/params'
import {
  activeTraceView,
  getTraceEditorMarkersForFile,
  getTraceEntryClass,
  isTraceViewEnabled,
  selectActiveTraceStep,
} from '~/composables/trace-view'
import { escapeHtml } from '~/utils/escape'
import CodeMirrorContainer from '../CodeMirrorContainer.vue'

const props = defineProps<{
  file: RunnerTestFile
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

watch(() => [loading.value, saving.value, props.file, lineNumber.value, columnNumber.value] as const, ([loadingFile, s, _, l, c]) => {
  if (!loadingFile && !s) {
    if (l != null) {
      nextTick(() => {
        const cp = currentPosition.value
        const line = cp ?? { line: (l ?? 1) - 1, ch: c ?? 0 }
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

const errors = computed(() => {
  const errors: TestError[] = []
  function addFailed(task: Task) {
    if (task.result?.errors) {
      errors.push(...task.result.errors as TestError[])
    }
    if (task.type === 'suite') {
      task.tasks.forEach(addFailed)
    }
  }
  props.file?.tasks.forEach(addFailed)
  return errors
})

const annotations = computed(() => {
  const annotations: TestAnnotation[] = []
  function addAnnotations(task: Task) {
    if (task.type === 'test') {
      annotations.push(...task.annotations)
    }
    if (task.type === 'suite') {
      task.tasks.forEach(addAnnotations)
    }
  }
  props.file?.tasks.forEach(addAnnotations)
  return annotations
})
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

const TRACE_GUTTER_ID = 'trace-step-gutter'
const traceGutterConfigs = isTraceViewEnabled(props.file)
  ? [{ className: TRACE_GUTTER_ID, style: 'width: 14px' }]
  : []
let traceGutterLines: number[] = []

const traceEditorMarkersForFile = computed(() => {
  const selection = activeTraceView.value
  const file = props.file?.filepath
  if (selection && file) {
    return getTraceEditorMarkersForFile(selection, file)
  }
  return []
})

function syncTraceMarkers() {
  const editor = codemirrorRef.value
  if (!editor) {
    return
  }

  for (const line of traceGutterLines) {
    editor.setGutterMarker(line, TRACE_GUTTER_ID, null)
  }
  traceGutterLines = []

  const lineCount = editor.lineCount()
  for (const marker of traceEditorMarkersForFile.value) {
    const line = marker.line - 1
    if (!(line >= 0 && line < lineCount)) {
      continue
    }
    const el = document.createElement('button')
    el.type = 'button'
    el.className = [
      'h-2 w-2 ml-0.5 cursor-pointer rounded-full bg-current',
      getTraceEntryClass(marker.entry),
      marker.active
        ? 'ring-2 ring-current ring-offset-1 ring-offset-white dark:ring-offset-gray-900'
        : 'opacity-75 scale-120',
    ].filter(Boolean).join(' ')
    el.dataset.testid = 'trace-editor-marker'
    el.ariaLabel = `Select trace step: ${marker.entry.name}`
    if (marker.active) {
      el.ariaCurrent = 'step'
    }
    el.addEventListener('click', () => {
      selectActiveTraceStep(marker.stepIndex)
    })
    editor.setGutterMarker(line, TRACE_GUTTER_ID, el)
    traceGutterLines.push(line)
  }
}

watch(
  [codemirrorRef, traceEditorMarkersForFile, loading],
  () => {
    syncTraceMarkers()
  },
  { immediate: true },
)

watch(
  draft,
  (d) => {
    emit('draft', d)
  },
  { immediate: true },
)

function createErrorElement(e: TestError) {
  const stacks = (e?.stacks || []).filter(
    i => i.file && i.file === props.file?.filepath,
  )
  const stack = stacks?.[0]
  if (!stack) {
    return
  }
  const div = document.createElement('div')
  div.dataset.testid = 'error-line-gadget'
  div.className = 'op80 flex gap-x-2 items-center'
  const pre = document.createElement('pre')
  pre.className = 'c-red-700 dark:c-red-400'
  const filter = createAnsiToHtmlFilter(isDark.value)
  pre.innerHTML = `${' '.repeat(stack.column)}^ ${filter.toHtml(escapeHtml(`${e.name}: ${e.message}`))}`
  div.appendChild(pre)
  const span = document.createElement('span')
  span.className
    = 'i-carbon-launch c-red-700 dark:c-red-400 hover:cursor-pointer min-w-1em min-h-1em'
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

function createAnnotationElement(annotation: TestAnnotation) {
  if (!annotation.location) {
    return
  }

  // TODO(v4): design
  const { line, file } = annotation.location
  if (file !== props.file?.filepath) {
    return
  }

  const notice = document.createElement('div')
  notice.classList.add(
    'wrap',
    'bg-active',
    'py-3',
    'px-6',
    'my-1',
  )
  notice.role = 'note'

  const messageWrapper = document.createElement('div')
  messageWrapper.classList.add('block', 'text-black', 'dark:text-white')

  const type = document.createElement('span')
  type.textContent = `${annotation.type}: `
  type.classList.add('font-bold')

  const message = document.createElement('span')
  message.classList.add('whitespace-pre')
  message.textContent = annotation.message.replace(/[^\r]\n/, '\r\n')

  messageWrapper.append(type, message)
  notice.append(messageWrapper)
  const attachment = annotation.attachment
  if (attachment?.path || attachment?.body) {
    if (attachment.contentType?.startsWith('image/')) {
      const link = document.createElement('a')
      const img = document.createElement('img')
      link.classList.add('inline-block', 'mt-3')
      link.style.maxWidth = '50vw'
      const potentialUrl = attachment.path || attachment.body
      if (typeof potentialUrl === 'string' && (potentialUrl.startsWith('http://') || potentialUrl.startsWith('https://'))) {
        img.setAttribute('src', potentialUrl)
        link.referrerPolicy = 'no-referrer'
      }
      else {
        img.setAttribute('src', getAttachmentUrl(attachment))
      }
      link.target = '_blank'
      link.href = img.src
      link.append(img)
      notice.append(link)
    }
    else {
      const download = document.createElement('a')
      download.href = getAttachmentUrl(attachment)
      download.download = sanitizeFilePath(annotation.message, attachment.contentType)
      download.classList.add('flex', 'w-min', 'gap-2', 'items-center', 'font-sans', 'underline', 'cursor-pointer')
      const icon = document.createElement('div')
      icon.classList.add('i-carbon:download', 'block')
      const text = document.createElement('span')
      text.textContent = 'Download'
      download.append(icon, text)
      notice.append(download)
    }
  }
  widgets.push(codemirrorRef.value!.addLineWidget(line - 1, notice))
}

const { pause, resume } = watch(
  [codemirrorRef, errors, annotations, finished] as const,
  ([cmValue, errors, annotations, end]) => {
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
      errors.forEach(createErrorElement)

      annotations.forEach(createAnnotationElement)

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
  errors.value.forEach(createErrorElement)
  annotations.value.forEach(createAnnotationElement)

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
    v-bind="{
      lineNumbers: true,
      readOnly: isReport || !config.api?.allowWrite,
      saving,
      gutters: ['CodeMirror-linenumbers', ...traceGutterConfigs],
    }"
    :mode="ext"
    data-testid="code-mirror"
    @save="onSave"
  />
</template>
