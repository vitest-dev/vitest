import { expect, test, vi } from 'vitest'
import { createStore } from '../../src/mocks/integration'

vi.mock('@vueuse/integrations/useJwt')

test('Using nested modules works', () => {
  const { payload } = createStore()

  expect(payload.value.sub).toBe('login')
})
