import { beforeEach, vi } from 'vitest'

vi.mock('../src/global-mock', () => ({ mocked: true }))

beforeEach(() => {
  // console.log(`hi ${s.name}`)
})
