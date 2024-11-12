import type { Task } from '@vitest/runner'
import type { Ref, WritableComputedRef } from 'vue'
import CodeMirror from 'codemirror'
import { watch } from 'vue'

import { navigateTo } from '~/composables/navigation'

import 'codemirror/mode/javascript/javascript'
// import 'codemirror/mode/css/css'
import 'codemirror/mode/xml/xml'
// import 'codemirror/mode/htmlmixed/htmlmixed'
import 'codemirror/mode/jsx/jsx'
import 'codemirror/addon/display/placeholder'
import 'codemirror/addon/scroll/simplescrollbars'
import 'codemirror/addon/scroll/simplescrollbars.css'

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
  navigateTo({
    file: task.file.id,
    line: task.location?.line ?? 0,
    view: 'editor',
    test: null,
  })
}
