import { expect, test } from 'vitest'

// fails only under vm pools, so `vitest doctor` has a failing candidate to report
test('does not run under a vm pool', () => {
  expect(process.execArgv.join(' ')).not.toContain('experimental-vm-modules')
})
