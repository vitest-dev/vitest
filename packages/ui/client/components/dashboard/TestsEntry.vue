<script setup lang="ts">
import { explorerTree } from '~/composables/explorer'
</script>

<template>
  <div flex="~ wrap" justify-evenly gap-2 p="x-4" relative>
    <DashboardEntry text-green5 data-testid="pass-entry">
      <template #header>
        Pass
      </template>
      <template #body>
        {{ explorerTree.summary.testsSuccess }}
      </template>
    </DashboardEntry>
    <DashboardEntry
      :class="{ 'text-red5': explorerTree.summary.testsFailed, 'op50': !explorerTree.summary.testsFailed }"
      data-testid="fail-entry"
    >
      <template #header>
        Fail
      </template>
      <template #body>
        {{ explorerTree.summary.testsFailed }}
      </template>
    </DashboardEntry>
    <DashboardEntry
      v-if="explorerTree.summary.testsSkipped"
      op50 data-testid="skipped-entry"
    >
      <template #header>
        Skip
      </template>
      <template #body>
        {{ explorerTree.summary.testsSkipped }}
      </template>
    </DashboardEntry>
    <DashboardEntry
      v-if="explorerTree.summary.testsTodo" op50
      data-testid="todo-entry"
    >
      <template #header>
        Todo
      </template>
      <template #body>
        {{ explorerTree.summary.testsTodo }}
      </template>
    </DashboardEntry>
    <DashboardEntry :tail="true" data-testid="total-entry">
      <template #header>
        Total
      </template>
      <template #body>
        {{ explorerTree.summary.totalTests }}
      </template>
    </DashboardEntry>
  </div>
</template>
