import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

// Regression test for https://github.com/vitest-dev/vitest/issues/9855
// Verifies that `vitest related` correctly resolves dependencies across
// multiple projects. The cache poisoning aspect of the bug (shared plugin
// caches corrupted by redundant transforms) requires @vitejs/plugin-vue
// with browser mode to reproduce and was verified against a real project.
describe('related with multiple projects', () => {
  it('correctly finds related tests across multiple projects', async () => {
    const root = resolve(import.meta.dirname, '../fixtures/related-multi-project')

    const { stdout, stderr } = await runVitest({
      root,
      related: resolve(root, 'src/shared.ts'),
      passWithNoTests: true,
    })

    expect(stderr).toBe('')
    expect(stdout).toContain('project-jsdom')
    expect(stdout).toContain('project-node')
    expect(stdout).toContain('2 passed')
  })

  it('does not run unrelated tests', async () => {
    const root = resolve(import.meta.dirname, '../fixtures/related-multi-project')

    const { stdout, stderr } = await runVitest({
      root,
      related: resolve(root, 'src/shared.ts'),
      passWithNoTests: true,
    })

    expect(stderr).toBe('')
    expect(stdout).not.toContain('unrelated')
  })
})
