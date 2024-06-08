<script setup lang="ts">
defineProps<{ label: string }>()
const modelValue = defineModel<boolean | null>()
</script>

<template>
  <label
    class="font-light text-sm checkbox flex items-center cursor-pointer py-1 text-md w-full gap-y-1"
    v-bind="$attrs"
    @click.prevent="modelValue = !modelValue"
  >
    <span
      :class="[
        modelValue ? 'i-carbon:checkbox-checked-filled' : 'i-carbon:checkbox',
      ]"
      text-lg
      aria-hidden="true"
    />
    <input
      v-model="modelValue"
      type="checkbox"
      sr-only
    >
    <span flex-1 ms-2 pointer-events-none>{{ label }}</span>
  </label>
</template>

<style>
.checkbox:focus-within {
  outline: none;
  @apply border-base border-b-base;
}
</style>
