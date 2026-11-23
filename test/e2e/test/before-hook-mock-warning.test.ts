import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

describe('before* hook mock cleanup warning', () => {
  test('warns once per hook when beforeEach or beforeAll returns a mock function', async () => {
    const { stderr, exitCode } = await runInlineTests({
      'basic.test.ts': /* ts */ `
        import { beforeAll, beforeEach, it, vi } from 'vitest'

        const target = { send: () => {} }
        const mock = vi.fn()

        beforeAll(() => mock.mockReset())
        beforeEach(() => vi.spyOn(target, 'send'))

        it('first', () => {})
        it('second', () => {})
      `,
    })

    expect(exitCode).toBe(0)
    expect(stderr.match(/Warning: "beforeAll" hook returned a mock function/g)).toHaveLength(1)
    expect(stderr.match(/Warning: "beforeEach" hook returned a mock function/g)).toHaveLength(1)
  })

  test('does not warn when before* hook returns a normal cleanup function', async () => {
    const { stderr, exitCode } = await runInlineTests({
      'plain.test.ts': /* ts */ `
        import { beforeAll, beforeEach, it } from 'vitest'

        beforeAll(() => () => {})
        beforeEach(() => () => {})

        it('first', () => {})
      `,
    })

    expect(exitCode).toBe(0)
    expect(stderr).not.toContain('hook returned a mock function')
  })
})
