<script setup lang="ts">
import { files, isConnected } from '~/composables/client'

const filesFailed = computed(() => {
  return files.value.filter(f => f.result?.state === 'fail').length
})
const filesPass = computed(() => {
  return files.value.filter(f => f.result?.state === 'pass').length
})
const finished = computed(() => {
  return files.value.length === filesFailed.value + filesPass.value
})
</script>

<template>
  <div v-if="isConnected" h-full flex="~ col gap-2" items-center justify-center>
    <ProgressBar :total="files.length" :failed="filesFailed" :pass="filesPass" :in-progress="!finished">
      <div text-center>
        Test Files <span class="test-c-failed">{{ filesFailed }} failed</span> | <span class="test-c-pass">{{ filesPass }} passed</span> <span class="test-c-pending">({{ files.length }})</span>
      </div>
    </ProgressBar>
  </div>
</template>
