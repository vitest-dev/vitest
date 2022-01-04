<script setup lang="ts">
import { current, runCurrent } from '~/composables/client'

const name = computed(() => current.value?.name.split(/\//g).pop())
</script>

<template>
  <div v-if="current" border="r base">
    <TasksList
      :tasks="current.tasks"
      :nested="true"
    >
      <template #header>
        <StatusIcon :task="current" />
        <span
          font-light
          text-sm
          flex-auto
          ws-nowrap
          overflow-hidden
          truncate
        >
          {{ name }}
        </span>
        <div class="flex text-lg">
          <IconButton icon="i-carbon-play" @click="runCurrent()" />
        </div>
      </template>
    </TasksList>
  </div>
</template>
