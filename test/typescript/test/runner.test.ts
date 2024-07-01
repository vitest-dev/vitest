import { resolve } from 'pathe'
import fg from 'fast-glob'
import { describe, expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

describe('should fail', async () => {
  const root = resolve(__dirname, '../failing')
  const files = await fg('*.test-d.*', { cwd: root })

  it('typecheck files', async () => {
    const { stderr } = await runVitest({
      root,
      dir: './failing',
      typecheck: {
        enabled: true,
        allowJs: true,
        include: ['**/*.test-d.*'],
      },
    })

    expect(stderr).toBeTruthy()
    const lines = String(stderr).split(/\n/g)
    const msg = lines
      .filter(i => i.includes('TypeCheckError: '))
      .reverse()
      .join('\n')
      .trim()
      .replace(root, '<rootDir>')
    expect(stderr).not.toMatch('files found, exiting with code')
    expect(msg).toMatchSnapshot()

    files.forEach((file) => {
      expect(String(stderr)).toMatch(`${file}:`)
    })

    lines.forEach((line, idx) => {
      if (line.includes('TypeCheckError')) {
        const msg = lines.slice(idx - 1, idx + 7).join('\n')
        expect(msg).toMatchSnapshot()
      }
    })
  })

  it('typecheks with custom tsconfig', async () => {
    const { stderr } = await runVitest({
      root,
      dir: resolve(__dirname, '..', './failing'),
      config: resolve('./test/vitest.custom.config.ts'),
      typecheck: { enabled: true },
    })

    const lines = String(stderr).split(/\n/g)
    const msg = lines
      .filter(i => i.includes('TypeCheckError: '))
      .reverse()
      .join('\n')
      .trim()
      .replace(root, '<rootDir>')
    expect(stderr).not.toMatch('files found, exiting with code')
    // only one test file is failed, because only one is included in tsconfig
    // + file with .only modifier
    expect(msg).toMatchSnapshot()

    expect(stderr).toContain('FAIL  fail.test-d.ts') // included in tsconfig

    // TODO: Why should this be picked as well?
    // expect(stderr).toContain('FAIL  only.test-d.ts') // .only

    // not included in tsconfig
    expect(stderr).not.toContain('expect-error.test-d.ts')
    expect(stderr).not.toContain('js-fail.test-d.js')
    expect(stderr).not.toContain('js.test-d.js')
    expect(stderr).not.toContain('test.test-d.ts')
  })

  it('typechecks empty "include" but with tests', async () => {
    const { stderr } = await runVitest({
      root,
      dir: resolve(__dirname, '..', './failing'),
      config: resolve(__dirname, './vitest.empty.config.ts'),
      typecheck: { enabled: true },
    },
    )

    expect(stderr.replace(resolve(__dirname, '..'), '<root>')).toMatchSnapshot()
  })
})

describe('ignoreSourceErrors', () => {
  it('disabled', async () => {
    const vitest = await runVitest({
      root: resolve(__dirname, '../fixtures/source-error'),
    })
    expect(vitest.stdout).toContain('Unhandled Errors')
    expect(vitest.stderr).toContain('Unhandled Source Error')
    expect(vitest.stderr).toContain('TypeCheckError: Cannot find name \'thisIsSourceError\'')
  })

  it('enabled', async () => {
    const vitest = await runVitest(
      {
        root: resolve(__dirname, '../fixtures/source-error'),
        typecheck: {
          ignoreSourceErrors: true,
          enabled: true,
        },
      },
    )
    expect(vitest.stdout).not.toContain('Unhandled Errors')
    expect(vitest.stderr).not.toContain('Unhandled Source Error')
    expect(vitest.stderr).not.toContain('TypeCheckError: Cannot find name \'thisIsSourceError\'')
  })
})
