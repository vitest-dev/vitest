<script setup lang="ts">
import { client, current } from '~/composables/state'

const name = computed(() => current.value?.name.split(/\//g).pop())

function run() {
  if (current.value?.filepath)
    client.rpc.rerun([current.value.filepath])
}
</script>

<template>
  <div v-if="current" overflow-auto border="r base">
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
          <IconButton icon="i-carbon-play" @click="run()" />
        </div>
      </template>
    </TasksList>
  </div>
</template>
