import { vi, expect, test } from 'vitest'
import { main } from './main.js'

vi.mock('lib/helper', { spy: true })

test('autospy resolves tsconfig paths from referenced config', () => {
  expect(main()).toBe(42)
})
