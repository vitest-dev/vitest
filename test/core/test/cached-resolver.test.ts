import type { WorkerGlobalState } from '../../../packages/vitest/src/types/worker'
import { pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'
import { distDir } from '../../../packages/vitest/src/paths'
import { getCachedVitestImport } from '../../../packages/vitest/src/runtime/moduleRunner/cachedResolver'

const DRIVE_LETTER_START_RE = /^[A-Z]:/i

function withLowercaseDrive(path: string): string {
  return path.replace(DRIVE_LETTER_START_RE, drive => drive.toLowerCase())
}

function withUppercaseDrive(path: string): string {
  return path.replace(DRIVE_LETTER_START_RE, drive => drive.toUpperCase())
}

test.runIf(process.platform === 'win32')('externalizes Vitest imports with a lowercase drive letter', () => {
  const id = `${withLowercaseDrive(distDir)}/index.js`

  const result = getCachedVitestImport(id, () => ({
    config: {
      root: distDir,
    },
  } as WorkerGlobalState))

  expect(result).toEqual({
    externalize: pathToFileURL(`${distDir}/index.js`).toString(),
    type: 'module',
  })
})

test.runIf(process.platform === 'win32')('normalizes /@fs/ Vitest imports to the project root drive letter', () => {
  const id = `${withUppercaseDrive(distDir)}/index.js`
  const root = withLowercaseDrive(distDir)

  const result = getCachedVitestImport(`/@fs/${id}`, () => ({
    config: {
      root,
    },
  } as WorkerGlobalState))

  expect(result).toEqual({
    externalize: pathToFileURL(`${withLowercaseDrive(distDir)}/index.js`).toString(),
    type: 'module',
  })
})
