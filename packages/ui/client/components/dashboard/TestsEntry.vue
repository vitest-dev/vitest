<script setup lang="ts">
import { tests, testsFailed, testsSkipped, testsSuccess, testsTodo } from '../../composables/summary'

const total = computed(() => tests.value.length)
const pass = computed(() => testsSuccess.value.length)
const failed = computed(() => testsFailed.value.length)
const skipped = computed(() => testsSkipped.value.length)
const todo = computed(() => testsTodo.value.length)
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
      Skipped
    </template>
    <template #body>
      {{ skipped }}
    </template>
  </DashboardEntry>
  <DashboardEntry classes="text-purple5">
    <template #header>
      Todo
    </template>
    <template #body>
      {{ todo }}
    </template>
  </DashboardEntry>
  <DashboardEntry classes="min-width-150px">
    <template #header>
      Total Tests
    </template>
    <template #body>
      {{ total }}
    </template>
  </DashboardEntry>
</template>
