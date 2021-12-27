<script setup lang="ts">
import { client, status } from '~/composables/state'

const color = computed(() => status.value === 'CONNECTING' ? 'bg-orange-400' : 'bg-red-400')
</script>

<template>
  <template v-if="status!== 'OPEN'">
    <div
      fixed left-0 bottom-0 right-0 p2 z-10
      :class="color"
      text="center sm white"
      @click="client.reconnect()"
    >
      <div
        flex="~ gap-2"
        items-center justify-center
        :class="status === 'CONNECTING' ? 'animate-pulse': ''"
      >
        <div
          text="xl"
          :class="status === 'CONNECTING' ? '' : 'i-carbon-wifi-off'"
        />
        {{ status === 'CONNECTING' ? 'Connecting...' : 'Disconnected' }}
      </div>
    </div>
  </template>
</template>
