import type { TestSpecification } from '../test-specification'
import fs from 'node:fs'
import { resolve } from 'pathe'

export const smartRerunCacheFilename = '.vitest-failed-cache.json'

interface SmartRerunCacheFile {
  failedFiles: string[]
}

export function getSmartRerunCachePath(root: string): string {
  return resolve(root, smartRerunCacheFilename)
}

export async function readSmartRerunCache(root: string): Promise<string[]> {
  const cachePath = getSmartRerunCachePath(root)
  if (!fs.existsSync(cachePath)) {
    return []
  }

  try {
    const content = await fs.promises.readFile(cachePath, 'utf8')
    const data = JSON.parse(content) as Partial<SmartRerunCacheFile>
    return Array.isArray(data.failedFiles) ? data.failedFiles : []
  }
  catch {
    return []
  }
}

export async function writeSmartRerunCache(root: string, failedFiles: string[]): Promise<void> {
  const cachePath = getSmartRerunCachePath(root)
  const data: SmartRerunCacheFile = { failedFiles }
  await fs.promises.writeFile(cachePath, JSON.stringify(data, null, 2))
}

export async function clearSmartRerunCache(root: string): Promise<void> {
  const cachePath = getSmartRerunCachePath(root)
  if (fs.existsSync(cachePath)) {
    await fs.promises.rm(cachePath, { force: true })
  }
}

// Moves specs for previously failed files to the front, keeping the relative order otherwise untouched.
export function prioritizeFailedSpecs(
  specs: TestSpecification[],
  failedFiles: string[],
): TestSpecification[] {
  if (!failedFiles.length) {
    return specs
  }

  const failed = new Set(failedFiles)
  const previouslyFailed: TestSpecification[] = []
  const rest: TestSpecification[] = []

  for (const spec of specs) {
    if (failed.has(spec.moduleId)) {
      previouslyFailed.push(spec)
    }
    else {
      rest.push(spec)
    }
  }

  return [...previouslyFailed, ...rest]
}

// Keeps only specs for previously failed files, skipping the rest of the suite.
// Falls back to every spec when the cache is empty or none of the cached files still match a spec.
export function filterToFailedSpecs(
  specs: TestSpecification[],
  failedFiles: string[],
): TestSpecification[] {
  if (!failedFiles.length) {
    return specs
  }

  const failed = new Set(failedFiles)
  const matched = specs.filter(spec => failed.has(spec.moduleId))

  return matched.length ? matched : specs
}
