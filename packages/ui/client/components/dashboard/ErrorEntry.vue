<script setup lang="ts">
  import { isPrimitive } from 'vitest/utils'

  const props = defineProps<{
    error: unkown
  }>()

  let e = props.error as ErrorWithDiff;

  if (isPrimitive(props.error)) {
    e = {
      message: String(error).split(/\n/g)[0],
      stack: String(error),
      name: ''
    }
  }

  if (!e) {
    const error = new Error('unknown error')
    e = {
      message: error.message,
      stack: error.stack,
      name: ''
    }
  }
</script>

<template>
  <h4 bg="red500/10" p-1 mb-1 mt-2 rounded>
    <span font-bold>
      {{ e.name || e.nameStr || 'Unknown Error' }}<template v-if="e.message">:</template>
    </span>
    {{ e.message }}
  </h4>
  <p v-if="e.VITEST_TEST_PATH" text="sm" font-thin mb-2>
    This error originated in <span font-bold>{{ e.VITEST_TEST_PATH }}</span> test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
  </p>
  <p v-if="e.VITEST_TEST_NAME" text="sm" font-thin mb-2>
    The latest test that might've caused the error is <span font-bold>{{ e.VITEST_TEST_NAME }}</span>. It might mean one of the following:<br>
    <ul>
      <li>
        The error was thrown, while Vitest was running this test.
      </li>
      <li>
        This was the last recorded test before the error was thrown, if error originated after test finished its execution.
      </li>
    </ul>
  </p>
  <p v-if="e.VITEST_AFTER_ENV_TEARDOWN" text="sm" font-thin>
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
