<script setup lang="ts">
import { tests, testsFailed, testsSkipped, testsSuccess, testsTodo } from '../composables/summary'

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
  <div grid gap-4 p-4 class="dashboard-grid">
    <DashboardEntry classes="text-red5">
      <template #header>
        Fail
      </template>
      <template #body>
        {{ failed }}
      </template>
      <template #footer>
        Tests
      </template>
    </DashboardEntry>
    <DashboardEntry classes="text-green5">
      <template #header>
        Pass
      </template>
      <template #body>
        {{ pass }}
      </template>
      <template #footer>
        Tests
      </template>
    </DashboardEntry>
    <DashboardEntry classes="text-yellow5">
      <template #header>
        Skipped
      </template>
      <template #body>
        {{ skipped }}
      </template>
      <template #footer>
        Tests
      </template>
    </DashboardEntry>
    <DashboardEntry classes="text-purple5">
      <template #header>
        Todo
      </template>
      <template #body>
        {{ todo }}
      </template>
      <template #footer>
        Tests
      </template>
    </DashboardEntry>
    <DashboardEntry classes="font-light">
      <template #header>
        Total Tests
      </template>
      <template #body>
        {{ total }}
      </template>
      <template #footer>
        Tests
      </template>
    </DashboardEntry>
  </div>
</template>

<style>
.dashboard-grid {
  grid-template-columns: repeat(auto-fill, minmax(150px, auto));
}
</style>
