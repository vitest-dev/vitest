<script setup lang="ts">
import { hasFailedSnapshot } from '@vitest/ws-client'
import { client, current, runCurrent } from '~/composables/client'

const name = computed(() => current.value?.name.split(/\//g).pop())

const failedSnapshot = computed(() => current.value?.tasks && hasFailedSnapshot(current.value?.tasks))
const updateSnapshot = () => current.value && client.rpc.updateSnapshot(current.value)
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
          <IconButton v-if="failedSnapshot" icon="i-carbon-result-new" @click="updateSnapshot()" />
          <IconButton icon="i-carbon-play" @click="runCurrent()" />
        </div>
      </template>
    </TasksList>
  </div>
</template>
