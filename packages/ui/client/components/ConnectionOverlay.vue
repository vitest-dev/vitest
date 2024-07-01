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
      fixed
      inset-0
      p2
      z-10
      select-none
      text="center sm"
      bg="overlay"
      backdrop-blur-sm
      backdrop-saturate-0
      @click="client.reconnect"
    >
      <div
        h-full
        flex="~ col gap-2"
        items-center
        justify-center
        :class="isConnecting ? 'animate-pulse' : ''"
      >
        <div
          text="5xl"
          :class="
            isConnecting
              ? 'i-carbon:renew animate-spin animate-reverse'
              : 'i-carbon-wifi-off'
          "
        />
        <div text-2xl>
          {{ isConnecting ? "Connecting..." : "Disconnected" }}
        </div>
        <div text-lg op50>
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
