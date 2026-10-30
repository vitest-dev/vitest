import { writeFileSync } from 'node:fs'
import { join } from 'pathe'
import { createDebugger } from '../../utils/debugger'

const debug = createDebugger('vitest:cache:tag')

// https://bford.info/cachedir/
const CACHEDIR_TAG = `Signature: 8a477f597d28d172789f06886806bc55
# This file is a cache directory tag created by Vitest.
# For information about cache directory tags see https://bford.info/cachedir/
`

const taggedDirs = new Set<string>()

/**
 * Marks a directory that Vitest owns as a cache, so backup tools and task runners
 * can skip it. An existing tag is never overwritten. The directory must exist.
 */
export function tagCacheDir(dir: string): void {
  if (taggedDirs.has(dir)) {
    return
  }
  taggedDirs.add(dir)
  try {
    writeFileSync(join(dir, 'CACHEDIR.TAG'), CACHEDIR_TAG, { flag: 'wx' })
  } catch (error: any) {
    // the tag is optional and must never fail the run
    if (error?.code !== 'EEXIST') {
      debug?.(`failed to tag ${dir} as a cache directory: ${error}`)
    }
  }
}

/**
 * Tags the directory again the next time it is used, after it was removed.
 */
export function forgetCacheDirTag(dir: string): void {
  taggedDirs.delete(dir)
}
