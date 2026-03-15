import type { CoverageMap, FileCoverage } from 'istanbul-lib-coverage'
import { expect } from 'vitest'
import { formatSummary } from './utils'

expect.addSnapshotSerializer({
  test: val => val.constructor.name === 'CoverageMap',
  serialize: (val: CoverageMap, config, indentation, depth, refs, printer) => {
    return printer(formatSummary(val.getCoverageSummary()), config, indentation, depth, refs)
  },
})

expect.addSnapshotSerializer({
  test: val => val.constructor.name === 'FileCoverage',
  serialize: (val: FileCoverage, config, indentation, depth, refs, printer) => {
    return printer(formatSummary(val.toSummary()), config, indentation, depth, refs)
  },
})

expect.addSnapshotSerializer({
  test: val => Array.isArray(val) && val.every(entry => entry.constructor.name === 'FileCoverage'),
  serialize: (val: FileCoverage[], config, indentation, depth, refs, printer) => {
    const summary = val.reduce((all, current) => ({
      ...all,
      [current.path]: formatSummary(current.toSummary()),
    }), {})

    return printer(summary, config, indentation, depth, refs)
  },
})
