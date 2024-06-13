<script setup lang="ts">
import { taskTree } from '~/composables/explorer/tree'
</script>

<template>
  <div flex="~ wrap" justify-evenly gap-2 p="x-4" relative>
    <DashboardEntry text-green5 data-testid="pass-entry">
      <template #header>
        Pass
      </template>
      <template #body>
        {{ taskTree.summary.testsSuccess }}
      </template>
    </DashboardEntry>
    <DashboardEntry :class="{ 'text-red5': taskTree.summary.testsFailed, 'op50': !taskTree.summary.testsFailed }" data-testid="fail-entry">
      <template #header>
        Fail
      </template>
      <template #body>
        {{ taskTree.summary.testsFailed }}
      </template>
    </DashboardEntry>
    <DashboardEntry v-if="taskTree.summary.testsSkipped" op50 data-testid="skipped-entry">
      <template #header>
        Skip
      </template>
      <template #body>
        {{ taskTree.summary.testsSkipped }}
      </template>
    </DashboardEntry>
    <DashboardEntry v-if="taskTree.summary.testsTodo" op50 data-testid="todo-entry">
      <template #header>
        Todo
      </template>
      <template #body>
        {{ taskTree.summary.testsTodo }}
      </template>
    </DashboardEntry>
    <DashboardEntry :tail="true" data-testid="total-entry">
      <template #header>
        Total
      </template>
      <template #body>
        {{ taskTree.summary.totalTests }}
      </template>
    </DashboardEntry>
  </div>
</template>
