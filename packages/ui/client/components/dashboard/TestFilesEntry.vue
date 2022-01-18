<script setup lang="ts">
import { files } from '../../composables/client'
import { filesFailed, filesSnapshotFailed, filesSuccess, time } from '../../composables/summary'
</script>

<template>
  <div
    grid="~ cols-[min-content_1fr_min-content]"
    items-center gap="x-2 y-3" p="x4" relative font-light w-80
    op80
  >
    <div i-carbon-document />
    <div>Files</div>
    <div class="number">
      {{ files.length }}
    </div>

    <template v-if="filesSuccess.length">
      <div i-carbon-checkmark />
      <div>Pass</div>
      <div class="number">
        {{ filesSuccess.length }}
      </div>
    </template>

    <template v-if="filesFailed.length">
      <div i-carbon-close />
      <div>
        Fail
      </div>
      <div class="number" text-red5>
        {{ filesFailed.length }}
      </div>
    </template>

    <template v-if="filesSnapshotFailed.length">
      <div i-carbon-compare />
      <div>
        Snapshot Fail
      </div>
      <div class="number" text-red5>
        {{ filesSnapshotFailed.length }}
      </div>
    </template>

    <div i-carbon-timer />
    <div>Time</div>
    <div class="number">
      {{ time }}
    </div>
  </div>
</template>

<style scoped>
.number {
  font-weight: 400;
  text-align: right;
}
</style>
