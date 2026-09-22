<script setup lang="ts">
import type { TestError } from '@vitest/utils'

defineProps<{
  error: TestError
}>()
</script>

<template>
  <h4 class="bg-red500/10 p-1 mb-1 mt-2 rounded">
    <span class="font-bold">
      {{ error.name || error.nameStr || 'Unknown Error' }}<template v-if="error.message">:</template>
    </span>
    {{ error.message }}
  </h4>
  <p v-if="error.stacks?.length" class="scrolls text-xs font-mono mx-1 my-2 pb-2 overflow-auto">
    <span v-for="(frame, i) in error.stacks" :key="i" class="whitespace-pre" :class="{ 'font-bold': i === 0 }">❯ {{ frame.method }} {{ frame.file }}:<span class="text-red500/70">{{ frame.line }}:{{ frame.column }}</span><br></span>
  </p>
  <p v-if="error.VITEST_TEST_PATH" class="text-sm mb-2">
    This error originated in <span class="font-bold">{{ error.VITEST_TEST_PATH }}</span> test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
  </p>
  <div v-if="error.VITEST_TEST_NAME" class="text-sm mb-2">
    The last test to run before this error was "<span class="font-bold">{{ error.VITEST_TEST_NAME }}</span>. This means either:<br>
    <ul>
      <li>
        The error was thrown while Vitest was running this test
      </li>
      <li>
        The error was thrown after the test completed, and this was the most recent test at that point
      </li>
    </ul>
  </div>
</template>
