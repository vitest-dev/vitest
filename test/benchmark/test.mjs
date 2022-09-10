import { readFile } from 'fs/promises'
import { startVitest } from 'vitest/node'

const success = await startVitest('benchmark', ['base.bench', 'mode.bench'], {
  run: true,
  update: false,
  outputFile: './bench.json', // TODO move outputFile to benchmark
  benchmark: {
    reporters: ['json'],
  },
})

const benchResult = await readFile('./bench.json', 'utf-8')

if (benchResult.includes('skip'))
  process.exit(1)

process.exit(success ? 0 : 1)
