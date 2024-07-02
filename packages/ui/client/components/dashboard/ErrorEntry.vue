<script setup lang="ts">
import type { ErrorWithDiff } from '@vitest/utils'

defineProps<{
  error: ErrorWithDiff
}>()
</script>

<template>
  <h4 bg="red500/10" p-1 mb-1 mt-2 rounded>
    <span font-bold>
      {{ error.name || error.nameStr || 'Unknown Error' }}<template v-if="error.message">:</template>
    </span>
    {{ error.message }}
  </h4>
  <p v-if="error.stacks?.length" class="scrolls" text="xs" font-mono mx-1 my-2 pb-2 overflow-auto>
    <span v-for="(frame, i) in error.stacks" :key="i" whitespace-pre :font-bold="i === 0 ? '' : null">❯ {{ frame.method }} {{ frame.file }}:<span text="red500/70">{{ frame.line }}:{{ frame.column }}</span><br></span>
  </p>
  <p v-if="error.VITEST_TEST_PATH" text="sm" mb-2>
    This error originated in <span font-bold>{{ error.VITEST_TEST_PATH }}</span> test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
  </p>
  <p v-if="error.VITEST_TEST_NAME" text="sm" mb-2>
    The latest test that might've caused the error is <span font-bold>{{ error.VITEST_TEST_NAME }}</span>. It might mean one of the following:<br>
    <ul>
      <li>
        The error was thrown, while Vitest was running this test.
      </li>
      <li>
        If the error occurred after the test had been completed, this was the last documented test before it was thrown.
      </li>
    </ul>
  </p>
  <p v-if="error.VITEST_AFTER_ENV_TEARDOWN" text="sm" font-thin>
    This error was caught after test environment was torn down. Make sure to cancel any running tasks before test finishes:<br>
    <ul>
      <li>
        Cancel timeouts using clearTimeout and clearInterval.
      </li>
      <li>
        Wait for promises to resolve using the await keyword.
      </li>
    </ul>
  </p>
</template>
