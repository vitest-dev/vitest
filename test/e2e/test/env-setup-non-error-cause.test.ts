import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('non-Error string thrown from env setup surfaces in stderr', async () => {
  const { stderr } = await runInlineTests({
    'throwing-env.js': `
export default {
  name: 'throwing-env',
  transformMode: 'ssr',
  async setup() {
    throw 'the real reason setup failed (a non-Error value)'
  },
}
    `,
    'vitest.config.js': `
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: './throwing-env.js',
  },
})
    `,
    'example.test.js': `
import { test, expect } from 'vitest'
test('noop', () => { expect(1).toBe(1) })
    `,
  })

  expect(stderr).toContain('Failed to start')
  expect(stderr).toContain('the real reason setup failed (a non-Error value)')
})

test('non-Error plain object thrown from env setup surfaces in stderr', async () => {
  const { stderr } = await runInlineTests({
    'throwing-env.js': `
export default {
  name: 'throwing-env',
  transformMode: 'ssr',
  async setup() {
    throw { reason: 'wasm-init-failed', code: 42 }
  },
}
    `,
    'vitest.config.js': `
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: './throwing-env.js',
  },
})
    `,
    'example.test.js': `
import { test, expect } from 'vitest'
test('noop', () => { expect(1).toBe(1) })
    `,
  })

  expect(stderr).toContain('Failed to start')
  expect(stderr).toMatch(/wasm-init-failed|reason/)
})

test('Error thrown from env setup still renders with Caused by prefix', async () => {
  const { stderr } = await runInlineTests({
    'throwing-env.js': `
export default {
  name: 'throwing-env',
  transformMode: 'ssr',
  async setup() {
    throw new Error('explicit error reason')
  },
}
    `,
    'vitest.config.js': `
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: './throwing-env.js',
  },
})
    `,
    'example.test.js': `
import { test, expect } from 'vitest'
test('noop', () => { expect(1).toBe(1) })
    `,
  })

  expect(stderr).toContain('Failed to start')
  expect(stderr).toContain('Caused by')
  expect(stderr).toContain('explicit error reason')
})
