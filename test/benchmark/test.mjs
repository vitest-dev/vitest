import { existsSync, rmSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { startVitest } from 'vitest/node'

if (existsSync('./bench.json'))
  rmSync('./bench.json')

try {
  await startVitest('benchmark', ['base.bench', 'mode.bench', 'only.bench'])
}
catch (error) {
  console.error(error)
  process.exit(1)
}

const benchResult = await readFile('./bench.json', 'utf-8')

if (benchResult.includes('skip'))
  process.exit(1)

const skippedBenches = ['s0', 's1', 's2', 's3', 'sb4', 's4']
if (skippedBenches.some(b => benchResult.includes(b)))
  process.exit(1)

const todoBenches = ['unimplemented suite', 'unimplemented test']
if (todoBenches.some(b => benchResult.includes(b)))
  process.exit(1)

process.exit(0)
