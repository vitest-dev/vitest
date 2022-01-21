<script setup lang="ts">
import { hasFailedSnapshot } from '@vitest/ws-client'
import { client, current, runCurrent } from '~/composables/client'

const name = computed(() => current.value?.name.split(/\//g).pop())

const failedSnapshot = computed(() => current.value?.tasks && hasFailedSnapshot(current.value?.tasks))
const updateSnapshot = () => current.value && client.rpc.updateSnapshot(current.value)
</script>

<template>
  <div v-if="current" h-full>
    <TasksList :tasks="current.tasks" :nested="true">
      <template #header>
        <StatusIcon ml-2 mr-3 :task="current" />
        <span font-bold text-sm flex-auto ws-nowrap overflow-hidden truncate>{{ name }}</span>
        <div class="flex text-lg">
          <IconButton
            v-if="failedSnapshot"
            v-tooltip.bottom="'Update failed snapshots'"
            icon="i-carbon-result-old"
            @click="updateSnapshot()"
          />
          <IconButton
            v-tooltip.bottom="'Rerun file'"
            icon="i-carbon-play"
            @click="runCurrent()"
          />
        </div>
      </template>
    </TasksList>
  </div>
</template>
