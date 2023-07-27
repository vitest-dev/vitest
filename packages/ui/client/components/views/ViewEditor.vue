<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type CodeMirror from 'codemirror'
import { createTooltip, destroyTooltip } from 'floating-vue'
import { openInEditor } from '../../composables/error'
import { client } from '~/composables/client'
import type { ErrorWithDiff, File } from '#types'
import { isDescribeBlock, selectedTest, testIndex } from '~/composables/params'

interface SplittedCode {
  code: string
  nestedCode?: SplittedCode[]
}

const props = defineProps<{
  file?: File
}>()

const emit = defineEmits<{ (event: 'draft', value: boolean): void }>()

const code = ref('')
const serverCode = shallowRef<string | undefined>(undefined)
const splittedCode = ref<SplittedCode[]>([])
const draft = ref(false)
watch([() => props.file, isDescribeBlock, selectedTest, testIndex],
  async ([newFile, newIsDescribeBlock, newSelectedTest, newTestIndex]) => {
    if (!props.file || !props.file?.filepath) {
      code.value = ''
      serverCode.value = code.value
      draft.value = false
      return
    }

    if (newFile?.filepath !== props.file.filepath || code.value === '') {
      code.value = await client.rpc.readFile(props.file.filepath) || ''
      serverCode.value = code.value
      draft.value = false

      const splittedArray = code.value.split(/\n/g).filter(item => item !== '' && !item.includes('import'))
      // To track if the loop has reached the end of the test i.e, -- })
      let isEndTestBracketsReached = false
      // Stores any individual test block value, it could be an it block or a describe block
      let testBlock = ''
      // Stores nested it or test blocks of describe tests
      let nestedTestBlock = ''
      let isDescribeBlock = false
      const newSplittedCode: SplittedCode[] = []
      let newNestedCode: { code: string }[] = []
      // Loop to store it or test or describe code blocks into individual array items
      splittedArray.forEach((item) => {
        if (isEndTestBracketsReached && item.replaceAll(' ', '') === '})') {
          if (isDescribeBlock && testBlock.includes('describe')) {
            if (testBlock.substring(testBlock.length - 3) === '})\n') {
              isDescribeBlock = false
              testBlock += `${item}\n`
              newSplittedCode.push({ code: testBlock, nestedCode: newNestedCode })
              newNestedCode = []
              testBlock = ''
              isEndTestBracketsReached = false
            }
            else {
              testBlock += `${item}\n`
              nestedTestBlock += `${item}\n`
              newNestedCode.push({ code: nestedTestBlock })
              nestedTestBlock = ''
            }
          }
          else {
            isEndTestBracketsReached = false
            testBlock += `${item}\n`
            newSplittedCode.push({ code: testBlock })
            testBlock = ''
          }
        }
        else if (isEndTestBracketsReached) {
          testBlock += `${item}\n`
          if (isDescribeBlock)
            nestedTestBlock += `${item}\n`
        }
        else if (item.replaceAll(' ', '').includes('()=>')) {
          testBlock += `${item}\n`
          isEndTestBracketsReached = true
          if (item.includes('describe'))
            isDescribeBlock = true
        }
      })
      splittedCode.value = newSplittedCode
    }

    if (newIsDescribeBlock !== null && newSelectedTest !== null && newTestIndex !== null && serverCode.value) {
      const [primaryIndex, nestedIndex] = newTestIndex.split('|')
      // First Method - Here we will get index and nestdIndex of items when user clicks on
      // test name and if the that indexes are present then we will show that code block.
      if (primaryIndex && primaryIndex !== 'undefined' && !Number.isNaN(Number.parseInt(primaryIndex))) {
        const nestedCodeValue = splittedCode.value[Number.parseInt(primaryIndex)].nestedCode?.[Number.parseInt(nestedIndex)]?.code
        if (nestedIndex && nestedIndex !== 'undefined' && !Number.isNaN(Number.parseInt(nestedIndex)) && nestedCodeValue) {
          code.value = nestedCodeValue
        }
        else if (nestedIndex && nestedIndex === 'undefined' && splittedCode.value[Number.parseInt(primaryIndex)]?.code) {
          code.value = splittedCode.value[Number.parseInt(primaryIndex)]?.code
        }
        else {
          // Second Method (fallback) - Here, based on the test name, we will search for that test and filter the string
          // block for that test.
          // Potential issue with this fallback method is that if there are two tests with the same name, then it will
          // show the test block whose name comes first in the string.
          const searchString = `${newIsDescribeBlock === '1' ? 'describe\\(' : '(test|it)\\('}('|")${newSelectedTest}('|"),`
          const searchStringRegex = new RegExp(searchString)
          const index = serverCode.value.search(searchStringRegex)
          if (index === -1) {
            code.value = serverCode.value
            return
          }
          const firstOccurance = serverCode.value?.substring(index)
          const lastOccuranceString = `${newIsDescribeBlock === '1' ? '})\n})' : '})'}`
          const lastIndex = firstOccurance.indexOf(lastOccuranceString)
          if (lastIndex === -1) {
            code.value = serverCode.value
            return
          }
          const result = firstOccurance.substring(0, lastIndex + lastOccuranceString.length)
          code.value = result
        }
      }
      else {
        // Second Method (fallback) - Here, based on the test name, we will search for that test and filter the string
        // block for that test.
        // Potential issue with this fallback method is that if there are two tests with the same name, then it will
        // show the test block whose name comes first in the string.
        const searchString = `${newIsDescribeBlock === '1' ? 'describe\\(' : '(test|it)\\('}('|")${newSelectedTest}('|"),`
        const searchStringRegex = new RegExp(searchString)
        const index = serverCode.value.search(searchStringRegex)
        if (index === -1) {
          code.value = serverCode.value
          return
        }
        const firstOccurance = serverCode.value?.substring(index)
        const lastOccuranceString = `${newIsDescribeBlock === '1' ? '})\n})' : '})'}`
        const lastIndex = firstOccurance.indexOf(lastOccuranceString)
        if (lastIndex === -1) {
          code.value = serverCode.value
          return
        }
        const result = firstOccurance.substring(0, lastIndex + lastOccuranceString.length)
        code.value = result
      }
    }
    else if (serverCode.value) {
      code.value = serverCode.value
    }
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

const showCodeResetButton = computed(() => testIndex !== null || isDescribeBlock !== null || selectedTest !== null)

const hasBeenEdited = ref(false)

function clearListeners() {
  listeners.forEach(([el, l, t]) => {
    el.removeEventListener('click', l)
    t()
  })
  listeners.length = 0
}

useResizeObserver(editor, () => {
  cm.value?.refresh()
})

function codemirrorChanges() {
  draft.value = serverCode.value !== cm.value!.getValue()
}

watch(draft, (d) => {
  emit('draft', d)
}, { immediate: true })

function createErrorElement(e: ErrorWithDiff) {
  const stacks = (e?.stacks || []).filter(i => i.file && i.file === props.file?.filepath)
  const stack = stacks?.[0]
  if (!stack)
    return
  const div = document.createElement('div')
  div.className = 'op80 flex gap-x-2 items-center'
  const pre = document.createElement('pre')
  pre.className = 'c-red-600 dark:c-red-400'
  pre.textContent = `${' '.repeat(stack.column)}^ ${e?.nameStr}: ${e?.message}`
  div.appendChild(pre)
  const span = document.createElement('span')
  span.className = 'i-carbon-launch c-red-600 dark:c-red-400 hover:cursor-pointer min-w-1em min-h-1em'
  span.tabIndex = 0
  span.ariaLabel = 'Open in Editor'
  createTooltip(span, {
    content: 'Open in Editor',
    placement: 'bottom',
  }, false)
  const el: EventListener = async () => {
    await openInEditor(stack.file, stack.line, stack.column)
  }
  div.appendChild(span)
  listeners.push([span, el, () => destroyTooltip(span)])
  handles.push(cm.value!.addLineClass(stack.line - 1, 'wrap', 'bg-red-500/10'))
  widgets.push(cm.value!.addLineWidget(stack.line - 1, div))
}

watch([cm, failed], ([cmValue]) => {
  if (!cmValue) {
    clearListeners()
    return
  }

  setTimeout(() => {
    clearListeners()
    widgets.forEach(widget => widget.clear())
    handles.forEach(h => cm.value?.removeLineClass(h, 'wrap'))
    widgets.length = 0
    handles.length = 0

    cmValue.on('changes', codemirrorChanges)

    failed.value.forEach((i) => {
      i.result?.errors?.forEach(createErrorElement)
    })
    if (!hasBeenEdited.value)
      cmValue.clearHistory() // Prevent getting access to initial state
  }, 100)
}, { flush: 'post' })

function handleCodeReset() {
  isDescribeBlock.value = null
  selectedTest.value = null
  testIndex.value = null
}

async function onSave(content: string) {
  hasBeenEdited.value = true
  await client.rpc.writeFile(props.file!.filepath, content)
  serverCode.value = content
  draft.value = false
}
</script>

<template>
  <div>
    <IconButton
      v-if="showCodeResetButton"
      v-tooltip.bottom="'Reset Code'"
      title="Clear search"
      icon="i-carbon:reset"
      @click.passive="handleCodeReset()"
    />
    <CodeMirror
      ref="editor"
      v-model="code"
      h-full
      v-bind="{ lineNumbers: true }"
      :mode="ext"
      data-testid="code-mirror"
      @save="onSave"
    />
  </div>
</template>
