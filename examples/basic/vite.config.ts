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

class CompareReporter extends BenchmarkReportsMap.json {
  async onFinished() {
    // TODO: use env var as flag for prototype

    // --compare
    const baseFile = process.env.VITEST_BENCH_COMPARE;

    // writing is not necessary when --compare
    // --benchmark.outputFile
    const newFile = process.env.VITEST_BENCH_OUTPUT_FILE ?? "bench-default.json";

    if (fs.existsSync(path.dirname(newFile)))
      await fs.promises.mkdir(path.dirname(newFile), { recursive: true })

    // for now, reuse json reporter to save file
    this.ctx.config.benchmark!.outputFile = newFile
    await super.onFinished()

    if (baseFile) {
      if (!fs.existsSync(baseFile)) {
        console.error('baseline not found:', baseFile)
        return;
      }
      // output comparison with baseline
      await compare(newFile, baseFile)
    }
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
