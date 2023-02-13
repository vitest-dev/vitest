import { readFileSync } from 'fs'
import { normalize } from 'pathe'

interface CoverageFinalJson {
  default: {
    [filename: string]: {
      path: string
      b: Record<string, number[]>
      f: Record<string, number>
      fnMap: Record<string, { name: string }>
      // ... and more unrelated keys
    }
  }
}

/**
 * Read JSON coverage report from file system.
 * Normalizes paths to keep contents consistent between OS's
 */
export async function readCoverageJson() {
  const jsonReport = JSON.parse(readFileSync('./coverage/coverage-final.json', 'utf8')) as CoverageFinalJson

  const normalizedReport: CoverageFinalJson['default'] = {}

  for (const [filename, coverage] of Object.entries(jsonReport)) {
    coverage.path = normalizeFilename(coverage.path)
    normalizedReport[normalizeFilename(filename)] = coverage
  }

  return normalizedReport
}

export function normalizeFilename(filename: string) {
  return normalize(filename).replace(normalize(process.cwd()), '<process-cwd>')
}
