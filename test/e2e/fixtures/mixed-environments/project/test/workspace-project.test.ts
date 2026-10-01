import { expect, test } from 'vitest'

test('Leaking globals not found', async () => {
  expect((globalThis as any).__leaking_from_workspace_project).toBe(undefined)

  ;(globalThis as any).__leaking_from_workspace_project = 'leaking'
})
