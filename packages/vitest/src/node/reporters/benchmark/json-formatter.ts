import type { File } from '@vitest/runner'
import type { BenchmarkResult } from '../../../runtime/types/benchmark'
import { getFullName, getTasks } from '@vitest/runner/utils'

interface Report {
  files: {
    filepath: string
    groups: Group[]
  }[]
}

interface Group {
  fullName: string
  benchmarks: FormattedBenchmarkResult[]
}

export type FormattedBenchmarkResult = BenchmarkResult & {
  id: string
}

export function createBenchmarkJsonReport(files: File[]) {
  const report: Report = { files: [] }

  for (const file of files) {
    const groups: Group[] = []

    for (const task of getTasks(file)) {
      if (task?.type === 'suite') {
        const benchmarks: FormattedBenchmarkResult[] = []

        for (const t of task.tasks) {
          const benchmark = t.meta.benchmark && t.result?.benchmark

          if (benchmark) {
            benchmarks.push({ id: t.id, ...benchmark, samples: [] })
          }
        }

        if (benchmarks.length) {
          groups.push({
            fullName: getFullName(task, ' > '),
            benchmarks,
          })
        }
      }
    }

    report.files.push({
      filepath: file.filepath,
      groups,
    })
  }

  return report
}

export function flattenFormattedBenchmarkReport(report: Report) {
  const flat: Record<FormattedBenchmarkResult['id'], FormattedBenchmarkResult> = {}

  for (const file of report.files) {
    for (const group of file.groups) {
      for (const t of group.benchmarks) {
        flat[t.id] = t
      }
    }
  }

  return flat
}
