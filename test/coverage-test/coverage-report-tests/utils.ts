import { normalize } from 'pathe'

interface CoverageFinalJson {
  default: {
    [filename: string]: {
      path: string
      b: Record<string, number[]>
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
  // @ts-expect-error -- generated file
  const { default: jsonReport } = await import('./coverage/coverage-final.json') as CoverageFinalJson

  const normalizedReport: CoverageFinalJson['default'] = {}

  for (const [filename, coverage] of Object.entries(jsonReport)) {
    coverage.path = normalizeFilename(coverage.path)
    normalizedReport[normalizeFilename(filename)] = coverage
  }

  return normalizedReport
}

function normalizeFilename(filename: string) {
  return normalize(filename).replace(normalize(process.cwd()), '<process-cwd>')
}
