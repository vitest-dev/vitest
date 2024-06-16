<script setup lang="ts">
import {
  tests,
  testsFailed,
  testsSkipped,
  testsSuccess,
  testsTodo,
} from "~/composables/summary";

const total = computed(() => tests.value.length);
const pass = computed(() => testsSuccess.value.length);
const failed = computed(() => testsFailed.value.length);
const skipped = computed(() => testsSkipped.value.length);
const todo = computed(() => testsTodo.value.length);
// const pending = computed(() => {
//   const t = unref(total)
//   return t - failed.value - pass.value
// })
</script>

<template>
  <div flex="~ wrap" justify-evenly gap-2 p="x-4" relative>
    <DashboardEntry text-green5 data-testid="pass-entry">
      <template #header> Pass </template>
      <template #body>
        {{ pass }}
      </template>
    </DashboardEntry>
    <DashboardEntry
      :class="{ 'text-red5': failed, op50: !failed }"
      data-testid="fail-entry"
    >
      <template #header> Fail </template>
      <template #body>
        {{ failed }}
      </template>
    </DashboardEntry>
    <DashboardEntry v-if="skipped" op50 data-testid="skipped-entry">
      <template #header> Skip </template>
      <template #body>
        {{ skipped }}
      </template>
    </DashboardEntry>
    <DashboardEntry v-if="todo" op50 data-testid="todo-entry">
      <template #header> Todo </template>
      <template #body>
        {{ todo }}
      </template>
    </DashboardEntry>
    <DashboardEntry :tail="true" data-testid="total-entry">
      <template #header> Total </template>
      <template #body>
        {{ total }}
      </template>
    </DashboardEntry>
  </div>
</template>
