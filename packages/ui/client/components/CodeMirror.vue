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

const modeMap: Record<string, string> = {
  html: 'htmlmixed',
  vue: 'htmlmixed',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'javascript',
  mts: 'javascript',
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
  setTimeout(() => cm.value!.refresh(), 100)
})
</script>

<template>
  <div
    relative
    font-mono
    overflow-auto
    text-sm
    h-full
  >
    <textarea ref="el" />
  </div>
</template>
