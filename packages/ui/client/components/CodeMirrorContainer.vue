<script setup lang="ts">
import { codemirrorRef } from '~/composables/codemirror'

const { mode, readOnly } = defineProps<{
  mode?: string
  readOnly?: boolean
  saving?: boolean
}>()

const emit = defineEmits<{
  (event: 'save', content: string): void
}>()

const modelValue = defineModel<string>()

const attrs = useAttrs()

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

onMounted(async () => {
  // useCodeMirror will remove the codemirrorRef.value on onUnmounted callback
  const codemirror = useCodeMirror(el, modelValue as unknown as Ref<string>, {
    ...attrs,
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
  codemirror.setSize('100%', '100%')
  codemirror.clearHistory()
  codemirrorRef.value = codemirror
  setTimeout(() => codemirrorRef.value!.refresh(), 100)
})
</script>

<template>
  <div relative font-mono text-sm class="codemirror-scrolls" :class="saving ? 'codemirror-busy' : undefined">
    <textarea ref="el" />
  </div>
</template>
