// @vitest-environment node

import { expect, test } from 'vitest'

const nodeMajor = Number(process.version.slice(1).split('.')[0])

test.runIf(nodeMajor > 16)('url correctly creates an object', () => {
  expect(() => {
    URL.createObjectURL(new Blob([]))
  }).not.toThrow()
})

test('ssr is enabled', () => {
  expect(import.meta.env.SSR).toBe(true)
})
