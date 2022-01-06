import { createStore } from '../src/integration'

vi.mock('@vueuse/integrations/useJwt')

test('Using nested modules works', () => {
  const { payload } = createStore()

  expect(payload.value.sub).toBe('login')
})
