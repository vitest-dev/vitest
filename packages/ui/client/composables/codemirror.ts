import type { Task, TestArtifactLocation } from '@vitest/runner'
import type { RunnerTestCase } from 'vitest'
import type { Ref, WritableComputedRef } from 'vue'
import CodeMirror from 'codemirror'

import { markRaw, onUnmounted, shallowRef, watch } from 'vue'

import { navigateTo } from '~/composables/navigation'
import { openInEditor } from './error'
import { selectedTest } from './params'
import 'codemirror/mode/javascript/javascript'
// import 'codemirror/mode/css/css'
import 'codemirror/mode/xml/xml'
import 'codemirror/mode/htmlmixed/htmlmixed'
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

export async function showTaskSource(task: Task) {
  navigateTo({
    file: task.file.id,
    line: task.location?.line ?? 1,
    view: 'editor',
    test: task.id,
    column: null,
  })
}

export function showLocationSource(fileId: string, location: { line: number; column: number }) {
  navigateTo({
    file: fileId,
    column: location.column - 1,
    line: location.line,
    view: 'editor',
    test: selectedTest.value,
  })
}

export function showAttachmentSource(task: RunnerTestCase, location?: TestArtifactLocation) {
  if (!location) {
    return
  }
  const { line, column, file } = location
  if (task.file.filepath !== file) {
    return openInEditor(file, line, column)
  }
  navigateTo({
    file: task.file.id,
    column: column - 1,
    line,
    view: 'editor',
    test: selectedTest.value,
  })
}
