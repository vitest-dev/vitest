import type { TestProject } from 'vitest/node'
import type { BrowserCommand } from '../plugin'
import { unlink } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'pathe'
import { PlaywrightBrowserProvider } from '../providers/playwright'

// TODO: print trace view location in reporter

export const startTracing: BrowserCommand<[]> = async ({ context, project, provider, sessionId }) => {
  if (provider instanceof PlaywrightBrowserProvider) {
    if (provider.tracingContexts.has(sessionId)) {
      return
    }

    provider.tracingContexts.add(sessionId)
    const options = project.config.browser!.trace
    await context.tracing.start({
      screenshots: options.screenshots ?? true,
      snapshots: options.snapshots ?? true,
      // currently, PW shows sources in private methods
      sources: false,
    }).catch(() => {
      provider.tracingContexts.delete(sessionId)
    })
    return
  }
  throw new TypeError(`The ${provider.name} provider does not support tracing.`)
}

export const startChunkTrace: BrowserCommand<[{ name: string; title: string }]> = async (
  context,
  { name, title },
) => {
  if (!context.testPath) {
    throw new Error(`stopChunkTrace cannot be called outside of the test file.`)
  }
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
      : resolveTracesPath(context.testPath, context.project, name)
    await context.context.tracing.stopChunk({ path })
    return { tracePath: path }
  }
  throw new TypeError(`The ${context.provider.name} provider does not support tracing.`)
}

function resolveTracesPath(testPath: string, project: TestProject, name: string) {
  const dir = dirname(testPath)
  const base = basename(testPath)
  return resolve(dir, '__traces__', base, `${project.name.replace(/[^a-z0-9]/gi, '-')}-${name}.trace.zip`)
}

export const deleteTracing: BrowserCommand<[{ traces: string[] }]> = async (
  context,
  { traces },
) => {
  if (!context.testPath) {
    throw new Error(`stopChunkTrace cannot be called outside of the test file.`)
  }
  if (context.provider instanceof PlaywrightBrowserProvider) {
    return Promise.all(
      traces.map(trace => unlink(trace).catch((err) => {
        if (err.code === 'ENOENT') {
        // Ignore the error if the file doesn't exist
          return
        }
        // Re-throw other errors
        throw err
      })),
    )
  }

  throw new Error(`provider ${context.provider.name} is not supported`)
}

export const annotateTraces: BrowserCommand<[{ traces: string[]; testId: string }]> = async (
  { project },
  { testId, traces },
) => {
  const vitest = project.vitest
  await Promise.all(traces.map((trace) => {
    return vitest._testRun.annotate(testId, {
      message: relative(project.config.root, trace),
      type: 'traces',
      attachment: {
        path: trace,
        contentType: 'application/octet-stream',
      },
    })
  }))
}
