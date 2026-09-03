<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'

const props = defineProps<{
  prompt: string
}>()

const state = ref<'idle' | 'copied' | 'error'>('idle')
const label = computed(() => state.value === 'copied' ? 'Copied' : 'Copy prompt')

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(props.prompt)
    state.value = 'copied'
  }
  catch {
    state.value = 'error'
  }
}
</script>

<template>
  <button type="button" class="copy-prompt" @click="copyPrompt">
    <Icon :icon="state === 'copied' ? 'carbon:checkmark' : 'carbon:copy'" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
  <span class="sr-only" role="status" aria-live="polite">
    {{ state === 'copied' ? 'Prompt copied to clipboard.' : state === 'error' ? 'Could not copy prompt.' : '' }}
  </span>
</template>

<style scoped>
.copy-prompt {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid color-mix(in srgb, var(--color-brand) 45%, transparent);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--color-brand) 10%, transparent);
  color: var(--vp-c-text-1);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
  cursor: pointer;
  transition: background-color 150ms, border-color 150ms, transform 150ms;
}

.copy-prompt:hover {
  border-color: var(--color-brand);
  background: color-mix(in srgb, var(--color-brand) 16%, transparent);
  transform: translateY(-1px);
}

.copy-prompt:focus-visible {
  outline: 2px solid var(--color-brand);
  outline-offset: 3px;
}

.copy-prompt svg {
  width: 1rem;
  height: 1rem;
}
</style>
