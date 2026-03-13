import { describe, test as base } from 'vitest'

const test = base.extend<{ value: string | undefined, setup: void }>({
  value: undefined,

  setup: [
    async ({ value }, use) => {
      if (!value) {
        return
      }

      await use(undefined)
    },
    { auto: true },
  ],
})

describe('fixture returned without calling use', () => {
  test('should fail with descriptive error', () => {})
})
