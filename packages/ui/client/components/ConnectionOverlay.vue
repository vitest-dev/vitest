<script setup lang="ts">
import {
  browserState,
  client,
  isConnected,
  isConnecting,
} from '~/composables/client'
</script>

<template>
  <template v-if="!isConnected">
    <div
      class="fixed inset-0 p2 z-10 select-none text-center text-sm bg-overlay backdrop-blur-sm backdrop-saturate-0"
      @click="client.reconnect"
    >
      <div
        class="h-full flex flex-col gap-2 items-center justify-center"
        :class="isConnecting ? 'animate-pulse' : ''"
      >
        <div
          class="text-5xl"
          :class="
            isConnecting
              ? 'i-carbon:renew animate-spin animate-reverse'
              : 'i-carbon-wifi-off'
          "
        />
        <div class="text-2xl">
          {{ isConnecting ? "Connecting..." : "Disconnected" }}
        </div>
        <div class="text-lg op50">
          Check your terminal or start a new server with `{{
            browserState
              ? `vitest --browser=${browserState.config.browser.name}`
              : "vitest --ui"
          }}`
        </div>
      </div>
    </div>
  </template>
</template>
