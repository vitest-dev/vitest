<script setup type="ts">
defineProps({
  icon: String,
})
</script>

<template>
  <div 
    bg="gray-200" 
    rounded-1 
    p-0.5
  >
    <div :class="icon" op50></div>
  </div>
</template>