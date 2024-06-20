import type { Ref, WritableComputedRef } from 'vue'
import { watch } from 'vue'
import CodeMirror from 'codemirror'
import 'codemirror/mode/javascript/javascript'

// import 'codemirror/mode/css/css'
import 'codemirror/mode/xml/xml'

// import 'codemirror/mode/htmlmixed/htmlmixed'
import 'codemirror/mode/jsx/jsx'
import 'codemirror/addon/display/placeholder'
import 'codemirror/addon/scroll/simplescrollbars'
import 'codemirror/addon/scroll/simplescrollbars.css'
import type { Task } from '@vitest/runner'
import { navigateTo } from '~/composables/navigation'

export const codemirrorRef = shallowRef<CodeMirror.EditorFromTextArea>()

export function useCodeMirror(
  textarea: Ref<HTMLTextAreaElement | null | undefined>,
  input: Ref<string> | WritableComputedRef<string>,
  options: CodeMirror.EditorConfiguration = {},
) {
  const cm = CodeMirror.fromTextArea(textarea.value!, {
    theme: 'vars',
    ...options,
    scrollbarStyle: 'simple',
  })

  let skip = false

  cm.on('change', () => {
    if (skip) {
      skip = false
      return
    }
    input.value = cm.getValue()
  })

  watch(
    input,
    (v) => {
      if (v !== cm.getValue()) {
        skip = true
        const selections = cm.listSelections()
        cm.replaceRange(
          v,
          cm.posFromIndex(0),
          cm.posFromIndex(Number.POSITIVE_INFINITY),
        )
        cm.setSelections(selections)
      }
    },
    { immediate: true },
  )

  onUnmounted(() => {
    codemirrorRef.value = undefined
  })

  return markRaw(cm)
}

export async function showSource(task: Task) {
  const codeMirror = codemirrorRef.value
  if (!codeMirror || activeFileId.value !== task.file.id) {
    navigateTo(task, true)
    // we need to await, CodeMirrow will take some time to initialize
    await new Promise(r => setTimeout(r, 256))
  }

  nextTick(() => {
    const line = { line: task.location?.line ?? 0, ch: 0 }
    codemirrorRef.value?.scrollIntoView(line)
    nextTick(() => {
      codemirrorRef.value?.focus()
      codemirrorRef.value?.setCursor(line)
    })
  })
}
