<script setup lang="ts">
import { testStatus } from '~/composables/summary'
</script>

<template>
  <div flex="~ wrap" justify-evenly gap-2 p="x-4" relative>
    <DashboardEntry text-green5 data-testid="pass-entry">
      <template #header>
        Pass
      </template>
      <template #body>
        {{ testStatus.testsSuccess }}
      </template>
    </DashboardEntry>
    <DashboardEntry :class="{ 'text-red5': testStatus.testsFailed, 'op50': !testStatus.testsFailed }" data-testid="fail-entry">
      <template #header>
        Fail
      </template>
      <template #body>
        {{ testStatus.testsFailed }}
      </template>
    </DashboardEntry>
    <DashboardEntry v-if="testStatus.testsSkipped" op50 data-testid="skipped-entry">
      <template #header>
        Skip
      </template>
      <template #body>
        {{ testStatus.testsSkipped }}
      </template>
    </DashboardEntry>
    <DashboardEntry v-if="testStatus.testsTodo" op50 data-testid="todo-entry">
      <template #header>
        Todo
      </template>
      <template #body>
        {{ testStatus.testsTodo }}
      </template>
    </DashboardEntry>
    <DashboardEntry :tail="true" data-testid="total-entry">
      <template #header>
        Total
      </template>
      <template #body>
        {{ testStatus.totalTests }}
      </template>
    </DashboardEntry>
  </div>
</template>
