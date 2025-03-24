<script setup lang="ts">
import { finished } from '~/composables/client/state'
import { explorerTree } from '~/composables/explorer'
</script>

<template>
  <div gap-0 flex="~ col gap-4" h-full justify-center items-center>
    <template v-if="explorerTree.summary.files === 0 && finished">
      <div class="text-gray-5">
        No tests found
      </div>
    </template>
    <section aria-labelledby="tests" m="y-4 x-2">
      <TestsEntry />
    </section>
    <TestFilesEntry />
  </div>
</template>
