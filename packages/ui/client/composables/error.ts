import type { Ref } from 'vue'
import type CodeMirror from 'codemirror'
import type { File, Task } from '#types'

export function shouldOpenInEditor(name: string, fileName?: string) {
  return fileName && name.endsWith(fileName)
}

export async function openInEditor(name: string, line: number, column: number) {
  const url = encodeURI(`${name}:${line}:${column}`)
  await fetch(`/__open-in-editor?file=${url}`)
}

export function useCodeError(
  props: Readonly<{ file?: File | undefined }>,
  cm: Ref<CodeMirror.EditorFromTextArea | undefined>,
  failed: Ref<Task[]>,
) {
  const widgets: CodeMirror.LineWidget[] = []
  const handles: CodeMirror.LineHandle[] = []
  const listeners: [el: HTMLSpanElement, l: EventListenerOrEventListenerObject][] = []

  const hasBeenEdited = ref(false)

  const clearListeners = () => {
    listeners.forEach(([el, l]) => {
      el.removeEventListener('click', l)
    })
    listeners.length = 0
  }

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
          span.className = 'i-carbon-launch text-red-900 hover:cursor-pointer'
          span.tabIndex = 0
          span.title = 'Open in IDE'
          const el: EventListenerOrEventListenerObject = async() => {
            await openInEditor(stacks[0].file, pos.line, pos.column)
          }
          listeners.push([span, el])
          span.addEventListener('click', el)
          div.appendChild(span)
          handles.push(cm.value!.addLineClass(pos.line - 1, 'wrap', 'bg-red-500/10'))
          widgets.push(cm.value!.addLineWidget(pos.line - 1, div))
        }
      })
      if (!hasBeenEdited.value) cm.value?.clearHistory() // Prevent getting access to initial state
    }, 100)
  }, { flush: 'post' })

  return { hasBeenEdited }
}
