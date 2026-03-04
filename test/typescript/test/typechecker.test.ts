import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

describe('Typechecker', () => {
  it('handles non-existing typechecker command gracefully', async () => {
    const { stderr } = await runVitest({
      root: resolve(import.meta.dirname, '../fixtures/source-error'),
      typecheck: {
        enabled: true,
        checker: 'non-existing-tsc-command',
      },
    })

    // Should show proper error when typechecker doesn't exist
    expect(stderr).toContain('Spawning typechecker failed')
  })
})
