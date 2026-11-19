import { expect, test, vi } from 'vitest'
import { greet } from './src/dynamic_greeting'
import { loadModule } from './src/dynamic_loader'

vi.mock('./src/dynamic_greeting', () => ({ greet: vi.fn(() => 'mocked') }))
vi.mock('./src/settings.json')

test('a computed path in the test file loads the mock', async () => {
  const path = './src/dynamic_greeting'
  const module = await import(/* @vite-ignore */ path)
  expect(module.greet).toBe(greet)
  expect(module.greet('Vitest')).toBe('mocked')
})

test('a computed path in a source file loads the mock', async () => {
  const module = await loadModule('./dynamic_greeting.ts')
  expect(module.greet).toBe(greet)
})

test('a computed path to json loads the __mocks__ file', async () => {
  const path = './src/settings.json'
  const module = await import(/* @vite-ignore */ path)
  expect(module.default).toEqual({ theme: 'dark' })
})

test('a computed path to a module without a mock loads the original', async () => {
  const path = './src/actions'
  const module = await import(/* @vite-ignore */ path)
  expect(module.plus(1, 2)).toBe(3)
})
