<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{
  href: string
}>()
</script>

<template>
  <a :href="href" target="_blank" class="course-link">
    <Icon icon="carbon:play-filled" class="course-icon" />
    <slot />
  </a>
</template>

<style scoped>
.course-link {
  background-color: rgb(34 197 94 / 0.1);
  padding: 0.75rem 1rem;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.course-icon {
  flex: none;
  font-size: 1.125rem;
}
</style>
