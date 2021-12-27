<script setup lang="ts">
import { current } from '~/composables/state'

const name = computed(() => current.value?.name.split(/\//g).pop())
</script>

<template>
  <div v-if="current" overflow-auto w-72 border="r base">
    <TasksList
      :tasks="current.tasks"
      :nested="true"
    >
      <template #header>
        <StatusIcon :task="current" />
        <span font-light text-sm flex-1>
          {{ name }}
        </span>
        <div class="flex text-lg">
          <IconButton icon="i-carbon-play" />
        </div>
      </template>
    </TasksList>
  </div>
</template>
