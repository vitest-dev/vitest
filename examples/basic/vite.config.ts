/// <reference types="vitest" />

// Configure Vitest (https://vitest.dev/config/)

import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import { Reporter } from 'vitest/reporters'
import type { BenchmarkResult, File, Task } from 'vitest'

/*

VITEST_BENCH_OUTPUT_FILE=main.json pnpm -C examples/basic test bench -- --run
VITEST_BENCH_COMPARE=main.json pnpm -C examples/basic test bench -- --run

*/

type BenchEntries = { [id: string]: Omit<BenchmarkResult, "samples"> };

function traverseTask(
  task: Task,
  callback: (task: Task, depth: number) => void,
  depth = 0,
) {
  if (task.type === "suite") {
    callback(task, depth);
    for (const t of task.tasks) {
      traverseTask(t, callback, depth + 1);
    }
  } else {
    callback(task, depth);
  }
}

export class CompareReporter implements Reporter {
  async onFinished(files: File[] = []) {
    // TODO: use env var as flag for prototype
    // --benchmark.outputFile
    const newFile = process.env.VITEST_BENCH_OUTPUT_FILE;
    // --compare
    const baseFile = process.env.VITEST_BENCH_COMPARE;

    let baseEntries: BenchEntries | undefined;
    if (baseFile) {
      if (fs.existsSync(baseFile)) {
        baseEntries = JSON.parse(await fs.promises.readFile(baseFile, "utf-8"));
      } else {
        console.error('baseline not found:', baseFile)
      }
    }

    if (!newFile && !baseFile) {
      console.log("use --benchmark.outputFile to save current run ");
      return;
    }

    if (baseFile) {
      console.log('')
      console.log('[BENCH] baseline:', path.resolve(baseFile));
      console.log('')
    }

    const currentEntries: BenchEntries = {}
    for (const file of files) {
      traverseTask(file, (t, depth) => {
        if (t.type === "suite") {
          console.log(" ".repeat(depth * 2), t.name);
          return;
        }
        if (t.result?.benchmark) {
          const { samples, ...current } = t.result.benchmark
          currentEntries[t.id] = current;

          const baseline = baseEntries?.[t.id];
          if (baseline) {
            const diff = current.hz / baseline.hz;
            console.log(
              " ".repeat(depth * 2),
              t.name,
              `${current.hz.toPrecision(5)}hz`,
              `[baseline: ${baseline.hz.toPrecision(5)}hz]`,
              `[change: ${diff.toFixed(2)}x ${diff > 1 ? '⇑' : '⇓'}]`,
            )
          } else {
            console.log(
              " ".repeat(depth * 2),
              `${current.hz.toPrecision(5)}hz`,
              `(no baseline)`,
            )
          }
        }
      })
    }

    if (newFile) {
      if (!fs.existsSync(path.dirname(newFile)))
        await fs.promises.mkdir(path.dirname(newFile), { recursive: true })
      await fs.promises.writeFile(newFile, JSON.stringify(currentEntries, null, 2));
    }
  }
}

export default defineConfig({
  test: {
    benchmark: {
      reporters: ['default', new CompareReporter()],
    },
  },
})
