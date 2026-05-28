import { cdp } from '@vitest/browser/context'
import { test } from 'vitest'

test('cdp throws an error', async () => {
  await cdp().send('Runtime.evaluate', { expression: '1 + 1' })
})
