import { getDefaultColors, setupColors } from '@vitest/utils'
import { beforeEach, vi } from 'vitest'

vi.mock('../src/global-mock', () => ({ mocked: true }))

beforeEach(() => {
  setupColors(getDefaultColors())
})
