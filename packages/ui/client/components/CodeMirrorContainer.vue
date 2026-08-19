<script setup lang="ts">
import type { EditorConfiguration, EditorFromTextArea } from 'codemirror'
import type { Ref } from 'vue'
import { onMounted, ref } from 'vue'
import { codemirrorRef, useCodeMirror } from '~/composables/codemirror'

const { mode, options, readOnly } = defineProps<{
  mode?: string
  options?: EditorConfiguration
  readOnly?: boolean
  saving?: boolean
}>()

const emit = defineEmits<{
  (event: 'save', content: string): void
  (event: 'codemirror', codemirror: EditorFromTextArea): void
}>()

const modelValue = defineModel<string>()

const modeMap: Record<string, any> = {
  html: 'htmlmixed',
  vue: 'htmlmixed',
  svelte: 'htmlmixed',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: { name: 'javascript', typescript: true },
  mts: { name: 'javascript', typescript: true },
  cts: { name: 'javascript', typescript: true },
  jsx: { name: 'text/jsx' },
  tsx: { name: 'text/typescript-jsx' },
}

const el = ref<HTMLTextAreaElement>()

onMounted(async () => {
  // useCodeMirror will remove the codemirrorRef.value on onUnmounted callback
  const codemirror = useCodeMirror(el, modelValue as unknown as Ref<string>, {
    ...options,
    mode: modeMap[mode || ''] || mode,
    readOnly: readOnly ? true : undefined,
    extraKeys: {
      'Cmd-S': function (cm) {
        const isReadonly = cm.getOption('readOnly')
        if (!isReadonly) {
          emit('save', cm.getValue())
        }
      },
      'Ctrl-S': function (cm) {
        const isReadonly = cm.getOption('readOnly')
        if (!isReadonly) {
          emit('save', cm.getValue())
        }
      },
    },
  })

  codemirror.on('refresh', () => {
    emit('codemirror', codemirror)
  })
  codemirror.on('change', () => {
    emit('codemirror', codemirror)
  })
  codemirror.setSize('100%', '100%')
  codemirror.clearHistory()
  codemirrorRef.value = codemirror
  setTimeout(() => codemirrorRef.value?.refresh(), 100)
})
</script>

<template>
  <div
    relative
    font-mono
    text-sm
    class="codemirror-scrolls"
    :class="{
      'codemirror-busy': saving,
      'codemirror-hide-cursor': readOnly,
    }"
  >
    <textarea ref="el" />
  </div>
</template>
