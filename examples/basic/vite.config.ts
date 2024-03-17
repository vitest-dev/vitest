/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)

// pnpm -C examples/basic test bench -- --run

// inspired by https://bheisler.github.io/criterion.rs/book/user_guide/command_line_options.html#baselines
// --save-baseline
// --baseline
// --load-baseline (no need?)

import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import { BenchmarkReportsMap } from 'vitest/reporters'
import type { BenchmarkResult } from 'vitest'

// node_modules/.vitest/bench/(save-baseline).json  // default new.json
// node_modules/.vitest/bench/(baseline).json       // default last new.json renambed to base.json
const benchDir = 'node_modules/.vitest/bench'

class CompareReporter extends BenchmarkReportsMap.json {
  // TODO: cli option? reporter option? env var?
  constructor(
    private options: {
      baseline?: string // TODO: support multiple comparison?
      saveBaseline?: string
    } = {},
  ) {
    super()
    // for now, use env var for configuration
    this.options.baseline = process.env.VITEST_BENCH_BASELINE
    this.options.saveBaseline = process.env.VITEST_BENCH_SAVE_BASELINE
  }

  async onFinished() {
    if (fs.existsSync(benchDir))
      await fs.promises.mkdir(benchDir, { recursive: true })

    let baseFile: string | undefined
    let newFile = path.join(benchDir, 'new.json')

    if (this.options?.baseline) {
      baseFile = path.join(benchDir, `${this.options.baseline}.json`)
      if (!fs.existsSync(baseFile)) {
        console.error('baseline not found:', baseFile)
        return
      }
    }
    else if (fs.existsSync(newFile)) {
      // if no baseline provided, rename last new.json to base.json
      baseFile = path.join(benchDir, 'base.json')
      await fs.promises.copyFile(newFile, baseFile)
    }

    if (this.options?.saveBaseline)
      newFile = path.join(benchDir, `${this.options.saveBaseline}.json`)

    // reuse json reporter
    this.ctx.config.benchmark!.outputFile = newFile
    await super.onFinished()

    // output comparison with baseline
    if (baseFile)
      await compare(newFile, baseFile)
  }
}

async function compare(newFile: string, baseFile: string) {
  console.log('')
  console.log(' [BENCH] Comparison')
  console.log('   current  :', newFile)
  console.log('   baseline :', baseFile)
  console.log('')
  const result = await parseResult(newFile)
  const baseline = await parseResult(baseFile)
  for (const [suite, tasks] of Object.entries(result)) {
    console.log(suite)
    for (const [name, curr] of Object.entries(tasks)) {
      const base = baseline[suite]?.[name]
      if (base) {
        const diff = curr.hz / base.hz
        console.log(
          ' ',
          name,
          `${curr.hz.toPrecision(5)}hz`,
          `[baseline: ${base.hz.toPrecision(5)}hz]`,
          `[change: ${diff.toFixed(2)}x ${diff > 1 ? '⇑' : '⇓'}]`,
        )
      }
      else {
        console.log(
          ' ',
          name,
          `${curr.hz.toPrecision(5)}hz`,
          '(no baseline)',
        )
      }
    }
  }
}

async function parseResult(file: string) {
  // TODO: no bench filename?
  interface RawResult { testResults: { [suite: string]: BenchmarkResult[] } }
  const raw: RawResult = JSON.parse(await fs.promises.readFile(file, 'utf-8'))
  const result: { [suite: string]: { [task: string]: BenchmarkResult } } = {}
  for (const suite in raw.testResults) {
    for (const task of raw.testResults[suite]) {
      result[suite] ??= {}
      result[suite][task.name] = task
    }
  }
  return result
}

export default defineConfig({
  test: {
    benchmark: {
      reporters: ['default', new CompareReporter()],
    },
  },
})
