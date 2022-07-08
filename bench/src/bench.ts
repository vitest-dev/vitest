import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs'

import type { Options } from 'execa'
import type { Deferred, Event, Target } from 'benchmark'

import Benchmark from 'benchmark'
import { execa } from 'execa'
import fsExtra from 'fs-extra'

const { copySync } = fsExtra

// eslint-disable-next-line no-console
const log = console.log

const fileCount = 50

const copyExclude = ['node_modules', 'package.json', 'vitest.config.ts', 'tsconfig.json']

// To not polute the repo with a lot of tests, copy basic tests multiple times
function copyTestFiles(suite: string) {
  for (let i = 0; i < fileCount; i++) {
    const path = `test/${suite}/test/${i}`
    if (!existsSync(path))
      mkdirSync(path, { recursive: true })
  }

  const files = readdirSync(`../examples/${suite}/`)
  for (const file of files.filter(f => !copyExclude.includes(f))) {
    for (let i = 0; i < fileCount; i++)
      copySync(`../examples/${suite}/${file}`, `test/${suite}/test/${i}/${file}`)
  }
}

function removeTestFiles(suite: string) {
  rmSync(`test/${suite}/test/`, { recursive: true })
}

function exit(suite: string, exitCode: number) {
  if (exitCode > 0) {
    removeTestFiles(suite)
    process.exit(exitCode)
  }
}

const testSuites = ['vue']

export type Result = Benchmark.Stats & {
  name: string
}

export function runBench(callback: (data: Result[]) => void) {
  const bench = new Benchmark.Suite()

  bench.on('cycle', (event: Event) => {
    const benchmark = event.target
    log(benchmark?.toString())
  })

  for (const suite of testSuites) {
    copyTestFiles(suite)

    const execaOptions: Options = {
      cwd: `test/${suite}`,
      stdio: 'inherit',
      env: {
        CI: 'true',
        NO_COLOR: 'true',
      },
    }

    bench.add(`vitest:${suite}`, {
      defer: true,
      fn: (deferred: Deferred) => execa('pnpm', ['test:vitest'], execaOptions)
        .on('exit', (code) => {
          if (code > 0)
            exit(suite, code)
          else
            deferred.resolve()
        }),
    })

    bench.add(`jest:${suite}`, {
      defer: true,
      fn: (deferred: Deferred) => execa('pnpm', ['test:jest'], execaOptions)
        .on('exit', (code) => {
          if (code > 0)
            exit(suite, code)
          else
            deferred.resolve()
        }),
    })
  }

  bench.on('complete', () => {
    const results = bench
      .map((run: Target): Result => ({
        name: run.name,
        ...run.stats,
      }))
      .sort((a, b) => { return a.mean - b.mean })

    callback(results)

    for (const suite of testSuites)
      removeTestFiles(suite)
  })

  bench.run()
}
