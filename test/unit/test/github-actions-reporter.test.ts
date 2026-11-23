import { describe, expect, it, vi } from 'vitest'
import { GithubActionsReporter } from 'vitest/node'

function createCoverageMap(files: Record<string, unknown>) {
  return {
    files: () => Object.keys(files),
    fileCoverageFor: (file: string) => ({ data: files[file] }),
  }
}

function createReporter(options?: ConstructorParameters<typeof GithubActionsReporter>[0]) {
  const log = vi.fn()
  const reporter = new GithubActionsReporter(options)
  reporter.onInit({ logger: { log } } as any)
  return { reporter, log }
}

describe('GithubActionsReporter coverage annotations', () => {
  it('does not emit coverage annotations by default', () => {
    const { reporter, log } = createReporter()
    reporter.onCoverage(createCoverageMap({
      '/repo/src/a.ts': {
        s: { '0': 0 },
        statementMap: { '0': { start: { line: 10 } } },
        f: {},
        fnMap: {},
        b: {},
        branchMap: {},
      },
    }))
    expect(log).not.toHaveBeenCalled()
  })

  it('does not emit coverage annotations when displayAnnotations is false', () => {
    const { reporter, log } = createReporter({ coverage: true, displayAnnotations: false })
    reporter.onCoverage(createCoverageMap({
      '/repo/src/a.ts': {
        s: { '0': 0 },
        statementMap: { '0': { start: { line: 10 } } },
        f: {},
        fnMap: {},
        b: {},
        branchMap: {},
      },
    }))
    expect(log).not.toHaveBeenCalled()
  })

  it('emits one grouped error annotation per uncovered file using onWritePath', () => {
    const { reporter, log } = createReporter({
      coverage: true,
      onWritePath: path => path.replace('/repo/', ''),
    })

    reporter.onCoverage(createCoverageMap({
      '/repo/src/covered.ts': {
        s: { '0': 1 },
        statementMap: { '0': { start: { line: 5 } } },
        f: { '0': 1 },
        fnMap: { '0': { loc: { start: { line: 1 } } } },
        b: { '0': [1, 1] },
        branchMap: { '0': { locations: [{ start: { line: 3 } }, { start: { line: 4 } }] } },
      },
      '/repo/src/render.ts': {
        s: { '0': 0, '1': 0, '2': 1 },
        statementMap: {
          '0': { start: { line: 40 } },
          '1': { start: { line: 41 } },
          '2': { start: { line: 50 } },
        },
        f: { '0': 0 },
        fnMap: { '0': { loc: { start: { line: 42 } } } },
        b: { '0': [1, 0] },
        branchMap: {
          '0': {
            locations: [
              { start: { line: 54 } },
              { start: { line: 55 } },
            ],
          },
        },
      },
    }))

    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(
      '\n::error file=src/render.ts,line=40,title=Uncovered code::Uncovered lines 40-42, 55',
    )
  })
})
