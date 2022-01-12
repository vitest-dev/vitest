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
  <div flex="~ col" items-center>
    <div flex="~ wrap" justify-evenly gap-2 p="x-4" relative>
      <DashboardEntry text-green5>
        <template #header>
          Files Passed
        </template>
        <template #body>
          {{ pass }}
        </template>
      </DashboardEntry>
      <DashboardEntry v-if="failed" text-red5>
        <template #header>
          Files Failed
        </template>
        <template #body>
          {{ failed }}
        </template>
      </DashboardEntry>
      <DashboardEntry min-width-150px>
        <template #header>
          Time
        </template>
        <template #body>
          {{ time }}
        </template>
      </DashboardEntry>
    </div>
    <div op80>
      of total <span text-xl>{{ total }}</span> files
    </div>
  </div>
</template>
