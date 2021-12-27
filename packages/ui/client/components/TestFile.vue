<script setup lang="ts">
import type { File } from 'vitest'

defineProps<{
  task: File
  active?: boolean
}>()
</script>

<template>
  <TaskItem :task="task" :class="active ? 'bg-active' : ''" />
</template>
