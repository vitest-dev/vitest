<script setup lang="ts">
import { explorerTree } from '~/composables/explorer'
import { filter } from '~/composables/explorer/state'
import DashboardEntry from './DashboardEntry.vue'

function toggleFilter(type: 'success' | 'failed' | 'skipped' | 'slow' | 'total') {
  // Reset all filters first
  filter.success = false
  filter.failed = false
  filter.skipped = false
  filter.slow = false

  if (type === 'total') {
    return
  }
  // Then set the selected one
  filter[type] = true
}
</script>

<template>
  <div flex="~ wrap" justify-evenly gap-2 p="x-4" relative>
    <DashboardEntry
      text-green-700 dark:text-green-500
      data-testid="pass-entry"
      cursor-pointer
      hover="op80"
      @click="toggleFilter('success')"
    >
      <template #header>
        Pass
      </template>
      <template #body>
        {{ explorerTree.summary.testsSuccess }}
      </template>
    </DashboardEntry>
    <DashboardEntry
      :class="{ 'text-red-700 dark:text-red-500': explorerTree.summary.testsFailed, 'op50': !explorerTree.summary.testsFailed }"
      data-testid="fail-entry"
      cursor-pointer
      hover="op80"
      @click="toggleFilter('failed')"
    >
      <template #header>
        Fail
      </template>
      <template #body>
        {{ explorerTree.summary.testsFailed }}
      </template>
    </DashboardEntry>
    <DashboardEntry
      v-if="explorerTree.summary.testsExpectedFail"
      text-cyan-700 dark:text-cyan-500
      data-testid="expected-fail-entry"
    >
      <template #header>
        Expected Fail
      </template>
      <template #body>
        {{ explorerTree.summary.testsExpectedFail }}
      </template>
    </DashboardEntry>
    <DashboardEntry
      v-if="explorerTree.summary.testsSkipped"
      text-purple-700 dark:text-purple-400
      data-testid="skipped-entry"
      cursor-pointer
      hover="op80"
      @click="toggleFilter('skipped')"
    >
      <template #header>
        Skip
      </template>
      <template #body>
        {{ explorerTree.summary.testsSkipped }}
      </template>
    </DashboardEntry>
    <DashboardEntry
      v-if="explorerTree.summary.testsTodo"
      op50
      data-testid="todo-entry"
    >
      <template #header>
        Todo
      </template>
      <template #body>
        {{ explorerTree.summary.testsTodo }}
      </template>
    </DashboardEntry>
    <DashboardEntry
      :tail="true"
      data-testid="total-entry"
      cursor-pointer
      hover="op80"
      @click="toggleFilter('total')"
    >
      <template #header>
        Total
      </template>
      <template #body>
        {{ explorerTree.summary.totalTests }}
      </template>
    </DashboardEntry>
    <DashboardEntry
      v-if="explorerTree.summary.testsSlow"
      text-yellow-700 dark:text-yellow-500
      data-testid="slow-entry"
      cursor-pointer
      hover="op80"
      @click="toggleFilter('slow')"
    >
      <template #header>
        Slow
      </template>
      <template #body>
        {{ explorerTree.summary.testsSlow }}
      </template>
    </DashboardEntry>
  </div>
</template>
