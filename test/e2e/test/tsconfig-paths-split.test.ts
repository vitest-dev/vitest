import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('resolve.tsconfigPaths follows paths in referenced tsconfig files', async () => {
  const { stderr, ctx } = await runVitest({
    root: './fixtures/tsconfig-paths-split',
    resolve: {
      tsconfigPaths: true,
    },
  })

  expect(stderr).toBe('')
  expect(ctx!.state.getFiles()[0]?.result?.state).toBe('pass')
})
