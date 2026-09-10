<script setup lang="ts">
import { finished } from '~/composables/client/state'
import { explorerTree } from '~/composables/explorer'
import TestFilesEntry from './TestFilesEntry.vue'
import TestsEntry from './TestsEntry.vue'
</script>

<template>
  <div class="flex flex-col gap-4 h-full justify-center items-center">
    <template v-if="explorerTree.summary.files === 0 && finished">
      <div class="text-gray-5">
        No tests found
      </div>
    </template>
    <section aria-labelledby="tests" class="my-4 mx-2">
      <TestsEntry />
    </section>
    <TestFilesEntry />
  </div>
</template>
