import { resolve } from 'pathe'
import { expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

it('should fail', async () => {
  const root = resolve(__dirname, '../fixtures/global-setup-fail')
  const { stderr } = await runVitest({ root })

  expect(stderr).toBeTruthy()
  const msg = String(stderr)
    .split(/\n/g)
    .reverse()
    .find(i => i.includes('Error: '))
    ?.trim()
  expect(msg).toBe('Error: error')
}, 50000)
