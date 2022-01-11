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
  <DashboardEntry classes="text-red5">
    <template #header>
      Fail
    </template>
    <template #body>
      {{ failed }}
    </template>
  </DashboardEntry>
  <DashboardEntry classes="text-green5">
    <template #header>
      Pass
    </template>
    <template #body>
      {{ pass }}
    </template>
  </DashboardEntry>
  <DashboardEntry classes="text-yellow5">
    <template #header>
      Running
    </template>
    <template #body>
      {{ pending }}
    </template>
  </DashboardEntry>
  <DashboardEntry classes="font-light">
    <template #header>
      Total Files
    </template>
    <template #body>
      {{ total }}
    </template>
  </DashboardEntry>
  <DashboardEntry classes="min-width-150px">
    <template #header>
      Time
    </template>
    <template #body>
      {{ time }}
    </template>
  </DashboardEntry>
</template>
