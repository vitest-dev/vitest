<script setup lang="ts">
const { disabled = false } = defineProps<{
  label: string
  disabled?: boolean
}>()
const modelValue = defineModel<boolean | null>()
</script>

<template>
  <label
    class="font-light text-sm checkbox w-fit flex items-center py-1 gap-y-1 mb-1px overflow-hidden relative"
    :class="disabled ? 'cursor-not-allowed op50' : 'cursor-pointer'"
    v-bind="$attrs"
  >
    <input
      v-model="modelValue"
      type="checkbox"
      :disabled="disabled"
      absolute
      inset-y-0
      start-0
      w-5
      op0
    >
    <span
      :class="[
        modelValue ? 'i-carbon:checkbox-checked-filled' : 'i-carbon:checkbox',
      ]"
      text-lg
      flex-shrink-0
      pointer-events-none
      aria-hidden="true"
    />
    <span flex-1 ms-2 select-none whitespace-nowrap truncate>{{ label }}</span>
  </label>
</template>

<style>
.checkbox:focus-within {
  outline: none;
  border-color: initial;
  /* don't add outline-none here => uno will add 2px to the outline */
  @apply focus-base border-b-1 !mb-none;
}
</style>
