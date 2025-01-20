import { test, expect } from 'vitest';
import condition from '@vitest/test-dep-conditions';
import { viteVersion } from 'vitest/node'

const viteMajor = Number(viteVersion.split('.')[0])

test('condition is correct', () => {
  expect(condition).toBe(viteMajor >= 6 ? 'node' : 'module')
})
