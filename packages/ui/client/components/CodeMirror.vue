<script setup lang="ts">
import { useCodeMirror } from '../composables/codemirror'

const attrs = useAttrs()
const emit = defineEmits<{ (input: any): void }>()
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

onMounted(async() => {
  const cm = useCodeMirror(el, input, {
    ...props,
    ...attrs,
    mode: modeMap[props.mode || ''] || props.mode,
  })
  cm.setSize('100%', '100%')
  setTimeout(() => cm.refresh(), 100)
})
</script>

<template>
  <div
    relative
    font-mono
    overflow-auto
    text-sm
  >
    <textarea ref="el" />
  </div>
</template>
