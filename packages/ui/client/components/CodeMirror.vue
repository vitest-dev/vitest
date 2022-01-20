<script setup lang="ts">
import type CodeMirror from 'codemirror'
import { useCodeMirror } from '../composables/codemirror'

const attrs = useAttrs()
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'save', content: string): void
}>()
const props = defineProps<{
  modelValue: string
  mode?: string
  readOnly?: boolean
}>()

const modeMap: Record<string, any> = {
  // html: 'htmlmixed',
  // vue: 'htmlmixed',
  // svelte: 'htmlmixed',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: { name: 'javascript', typescript: true },
  mts: { name: 'javascript', typescript: true },
  cts: { name: 'javascript', typescript: true },
  jsx: { name: 'javascript', jsx: true },
  tsx: { name: 'javascript', typescript: true, jsx: true },
}

const el = ref<HTMLTextAreaElement>()
const input = useVModel(props, 'modelValue', emit, { passive: true })

const cm = shallowRef<CodeMirror.EditorFromTextArea>()

defineExpose({ cm })

onMounted(async() => {
  cm.value = useCodeMirror(el, input, {
    ...props,
    ...attrs,
    mode: modeMap[props.mode || ''] || props.mode,
    readOnly: props.readOnly ? 'nocursor' : undefined,
    extraKeys: {
      'Cmd-S': function(cm) {
        emit('save', cm.getValue())
      },
      'Ctrl-S': function(cm) {
        emit('save', cm.getValue())
      },
    },
  })
  cm.value.setSize('100%', '100%')
  cm.value.clearHistory()
  setTimeout(() => cm.value!.refresh(), 100)
})
</script>

<template>
  <div
    relative
    font-mono
    text-sm
    class="scrolls"
  >
    <textarea ref="el" />
  </div>
</template>
