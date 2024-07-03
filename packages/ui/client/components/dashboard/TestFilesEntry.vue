<script setup lang="ts">
import { unhandledErrors } from '~/composables/client/state'
import { explorerTree } from '~/composables/explorer'
</script>

<template>
  <div
    data-testid="test-files-entry"
    grid="~ cols-[min-content_1fr_min-content]"
    items-center
    gap="x-2 y-3"
    p="x4"
    relative
    font-light
    w-80
    op80
  >
    <div i-carbon-document />
    <div>Files</div>
    <div class="number" data-testid="num-files">
      {{ explorerTree.summary.files }}
    </div>

    <template v-if="explorerTree.summary.filesSuccess">
      <div i-carbon-checkmark />
      <div>Pass</div>
      <div class="number">
        {{ explorerTree.summary.filesSuccess }}
      </div>
    </template>

    <template v-if="explorerTree.summary.filesFailed">
      <div i-carbon-close />
      <div>
        Fail
      </div>
      <div class="number" text-red5>
        {{ explorerTree.summary.filesFailed }}
      </div>
    </template>

    <template v-if="explorerTree.summary.filesSnapshotFailed">
      <div i-carbon-compare />
      <div>
        Snapshot Fail
      </div>
      <div class="number" text-red5>
        {{ explorerTree.summary.filesSnapshotFailed }}
      </div>
    </template>

    <template v-if="unhandledErrors.length">
      <div i-carbon-checkmark-outline-error />
      <div>
        Errors
      </div>
      <div class="number" text-red5>
        {{ unhandledErrors.length }}
      </div>
    </template>

    <div i-carbon-timer />
    <div>Time</div>
    <div class="number" data-testid="run-time">
      {{ explorerTree.summary.time }}
    </div>
  </div>
  <template v-if="unhandledErrors.length">
    <div bg="red500/10" text="red500" p="x3 y2" max-w-xl m-2 rounded>
      <h3 text-center mb-2>
        Unhandled Errors
      </h3>
      <p text="sm" font-thin mb-2 data-testid="unhandled-errors">
        Vitest caught {{ unhandledErrors.length }} error{{ unhandledErrors.length > 1 ? 's' : '' }} during the test run.<br>
        This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.
      </p>
      <details
        data-testid="unhandled-errors-details"
        class="scrolls unhandled-errors"
        text="sm"
        font-thin
        pe-2.5
        open:max-h-52
        overflow-auto
      >
        <summary font-bold cursor-pointer>
          Errors
        </summary>
        <ErrorEntry v-for="(e, idx) in unhandledErrors" :key="idx" :error="e" />
      </details>
    </div>
  </template>
</template>

<style scoped>
.number {
  font-weight: 400;
  text-align: right;
}

.unhandled-errors {
  --cm-ttc-c-thumb: #ccc;
}

html.dark .unhandled-errors {
  --cm-ttc-c-thumb: #444;
}
</style>
