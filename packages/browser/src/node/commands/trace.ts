import type { BrowserCommand } from '../plugin'
import { unlink } from 'node:fs/promises'
import { basename, dirname, resolve } from 'pathe'
import { PlaywrightBrowserProvider } from '../providers/playwright'

// TODO: print trace view location

export const startTracing: BrowserCommand<[]> = async (context) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const options = context.project.config.browser!.trace
    await context.context.tracing.start({
      screenshots: options.screenshots ?? true,
      snapshots: options.snapshots ?? true,
      sources: options.sources ?? true,
    })
    return
  }
  throw new TypeError(`The ${context.provider.name} provider does not support tracing.`)
}

export const startChunkTrace: BrowserCommand<[{ name: string; title: string }]> = async (
  context,
  { name, title },
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    await context.context.tracing.startChunk({ name, title })
    return
  }
  throw new TypeError(`The ${context.provider.name} provider does not support tracing.`)
}

export const stopChunkTrace: BrowserCommand<[{ name: string }]> = async (
  context,
  { name },
) => {
  if (!context.testPath) {
    throw new Error(`stopChunkTrace cannot be called outside of the test file.`)
  }
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const options = context.project.config.browser!.trace
    const path = options.tracesDir
      ? resolve(options.tracesDir, name)
      : resolveTracesPath(context.testPath, name)
    await context.context.tracing.stopChunk({ path })
    return
  }
  throw new TypeError(`The ${context.provider.name} provider does not support tracing.`)
}

function resolveTracesPath(testPath: string, name: string) {
  const dir = dirname(testPath)
  const base = basename(testPath)
  return resolve(dir, '__traces__', base, `${name}.zip`)
}

// export const stopTrace: BrowserCommand<[]> = async (context) => {
//   if (context.provider instanceof PlaywrightBrowserProvider) {
//     await context.context.tracing.stop()
//     return
//   }
//   throw new TypeError(`The ${context.provider.name} provider does not support tracing.`)
// }

export const deleteTracing: BrowserCommand<[{ name: string }]> = async (
  context,
  { name },
) => {
  if (!context.testPath) {
    throw new Error(`stopChunkTrace cannot be called outside of the test file.`)
  }
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const options = context.project.config.browser!.trace
    const path = options.tracesDir
      ? resolve(options.tracesDir, name)
      : resolveTracesPath(context.testPath, name)
    return await unlink(path).catch((err) => {
      if (err.code === 'ENOENT') {
        // Ignore the error if the file doesn't exist
        return
      }
      // Re-throw other errors
      throw err
    })
  }

  throw new Error(`provider ${context.provider.name} is not supported`)
}
