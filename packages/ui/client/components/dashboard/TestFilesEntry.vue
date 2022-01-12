<script setup lang="ts">
import { files } from '../../composables/client'
import { filesFailed, filesSuccess, time } from '../../composables/summary'

const total = computed(() => files.value.length)
const pass = computed(() => filesSuccess.value.length)
const failed = computed(() => filesFailed.value.length)
const pending = computed(() => {
  const t = unref(total)
  return t - failed.value - pass.value
})
</script>

<template>
  <div flex="~ wrap" justify-evenly gap-2 p="x-4" relative>
    <DashboardEntry text-green5>
      <template #header>
        Pass
      </template>
      <template #body>
        {{ pass }}
      </template>
    </DashboardEntry>
    <DashboardEntry v-if="failed" text-red5>
      <template #header>
        Fail
      </template>
      <template #body>
        {{ failed }}
      </template>
    </DashboardEntry>
    <DashboardEntry>
      <template #header>
        Total
      </template>
      <template #body>
        {{ total }}
      </template>
    </DashboardEntry>
    <DashboardEntry :tail="true">
      <template #header>
        Time
      </template>
      <template #body>
        {{ time }}
      </template>
    </DashboardEntry>
  </div>
</template>
