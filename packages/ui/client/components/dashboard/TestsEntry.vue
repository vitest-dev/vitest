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
  <div flex="~ col" items-center>
    <div flex="~ wrap" justify-evenly gap-2 p="x-4" relative>
      <DashboardEntry text-green5>
        <template #header>
          Tests Passed
        </template>
        <template #body>
          {{ pass }}
        </template>
      </DashboardEntry>
      <DashboardEntry v-if="failed" text-red5>
        <template #header>
          Tests Failed
        </template>
        <template #body>
          {{ failed }}
        </template>
      </DashboardEntry>
      <DashboardEntry v-if="skipped" op40>
        <template #header>
          Tests Skipped
        </template>
        <template #body>
          {{ skipped }}
        </template>
      </DashboardEntry>
      <DashboardEntry v-if="todo" op40>
        <template #header>
          Tests Todo
        </template>
        <template #body>
          {{ todo }}
        </template>
      </DashboardEntry>
    </div>
    <div op80>
      of total <span text-xl>{{ total }}</span> tests
    </div>
  </div>
</template>
