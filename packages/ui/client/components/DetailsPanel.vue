<script setup lang="ts">
defineProps<{
  color?: string
}>()

const open = ref(true)
</script>

<template>
  <div
    :open="open"
    class="details-panel"
    data-testid="details-panel"
    @toggle="open = $event.target.open"
  >
    <div
      p="y1"
      text-sm
      bg-base
      items-center
      z-5
      gap-2
      :class="color"
      w-full
      flex
      select-none
      sticky
      top="-1"
    >
      <div flex-1 h-1px border="base b" op80 />
      <slot name="summary" :open="open" />
      <div flex-1 h-1px border="base b" op80 />
    </div>
    <slot />
  </div>
</template>

<style>
.details-panel {
  user-select: none;
  width: 100%;
}
</style>
