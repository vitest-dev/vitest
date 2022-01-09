<script setup lang="ts">
import { files, isConnected } from '~/composables/client'

const failed = computed(() => files.value.filter(task => task.result?.state === 'fail'))
const success = computed(() => files.value.filter(task => task.result?.state === 'pass'))
const skipped = computed(() => files.value.filter(task => task.mode === 'skip' || task.mode === 'todo'))
const running = computed(() => files.value.filter(task =>
  !failed.value.includes(task)
    && !success.value.includes(task)
    && !skipped.value.includes(task),
))
const finished = computed(() => {
  return running.value.length === 0
})
</script>

<template>
  <div v-if="isConnected" h-full flex="~ col gap-2" items-center justify-center>
    <ProgressBar :total="files.length" :failed="failed.length" :pass="success.length" :in-progress="!finished">
      <div text-center>
        Test Files <span text-red5>{{ failed.length }} failed</span> | <span text-green5>{{ success.length }} passed</span> | <span text-yellow5>{{ running.length }} running</span> <span c-gray op-75>({{ files.length }})</span>
      </div>
    </ProgressBar>
  </div>
</template>
