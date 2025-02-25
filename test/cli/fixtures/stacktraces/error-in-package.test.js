import { test } from 'vitest'
import { testStack } from "@vitest/test-dep-error"

test('error in package', () => {
  testStack()
})
