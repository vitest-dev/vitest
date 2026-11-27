import { expect, test, vi } from 'vitest'

test('importer waits for a module that stopped importing it after vi.resetModules()', async () => {
  // x imports y, which imports x
  vi.stubEnv('RESET_MODULES_CYCLE', '1')
  await import('./fixtures/reset-modules-cycle/x')
  vi.resetModules()
  vi.unstubAllEnvs()

  // x no longer imports y, so y has to wait for x
  const x = import('./fixtures/reset-modules-cycle/x')
  await new Promise((resolve) => setTimeout(resolve, 50))
  const { seen } = await import('./fixtures/reset-modules-cycle/y')
  await x
  expect(seen).toBe('ready')
})
