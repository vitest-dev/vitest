import type { SerializedLocator } from '@vitest/browser'
import type { ParsedStack } from 'vitest'
import type { BrowserCommand, BrowserCommandContext, BrowserProvider } from 'vitest/node'
import type { PlaywrightBrowserProvider } from '../playwright'
import { createHash } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import { assertBrowserApiWrite, assertBrowserFileAccess } from '@vitest/browser'
import { truncateFileName } from '@vitest/utils/helpers'
import { basename, dirname, resolve } from 'pathe'
import { getDescribedLocator } from './utils'

export const startTracing: BrowserCommand<[]> = async ({
  context,
  project,
  provider,
  sessionId,
}) => {
  if (isPlaywrightProvider(provider)) {
    if (provider.tracingContexts.has(sessionId)) {
      return
    }

    provider.tracingContexts.add(sessionId)
    const options = project.config.browser!.trace
    await context.tracing
      .start({
        screenshots: options.screenshots ?? true,
        snapshots: options.snapshots ?? true,
        sources: options.sources ?? true,
      })
      .catch(() => {
        provider.tracingContexts.delete(sessionId)
      })
    return
  }
  throw new TypeError(`The ${provider.name} provider does not support tracing.`)
}

export const startChunkTrace: BrowserCommand<[{ name: string; title: string }]> = async (
  command,
  { name, title },
) => {
  const { provider, project, sessionId, testPath, context } = command
  if (!testPath) {
    throw new Error(`stopChunkTrace cannot be called outside of the test file.`)
  }
  if (isPlaywrightProvider(provider)) {
    if (!provider.tracingContexts.has(sessionId)) {
      await startTracing(command)
    }
    const traceName = resolveTraceName(project.name, name)
    const path = resolveTracesPath(command, traceName)
    provider.pendingTraces.set(path, sessionId)
    // keep Playwright's intermediate archive separate from the final trace
    await context.tracing.startChunk({ name: `${traceName}.pw`, title })
    return
  }
  throw new TypeError(`The ${provider.name} provider does not support tracing.`)
}

export const stopChunkTrace: BrowserCommand<[{ name: string }]> = async (context, { name }) => {
  if (isPlaywrightProvider(context.provider)) {
    const path = resolveTracesPath(context, resolveTraceName(context.project.name, name))
    assertBrowserApiWrite(context.project, path)
    assertBrowserFileAccess(context.project, path)
    context.provider.pendingTraces.delete(path)
    await context.context.tracing.stopChunk({ path })
    return { tracePath: path }
  }
  throw new TypeError(`The ${context.provider.name} provider does not support tracing.`)
}

export const markTrace: BrowserCommand<
  [payload: { name: string; element?: SerializedLocator; stack?: string }]
> = async (context, payload) => {
  if (isPlaywrightProvider(context.provider)) {
    // skip if tracing is not active
    // this is only safe guard and this isn't expected to happen since
    // runner already checks if tracing is active before sending this command
    if (!context.provider.tracingContexts.has(context.sessionId)) {
      return
    }
    const { name, element, stack } = payload
    const location = parseLocation(context, stack)
    // mark trace via group/groupEnd with dummy calls to force snapshot.
    // https://github.com/microsoft/playwright/issues/39308
    await context.context.tracing.group(name, { location })
    try {
      if (element) {
        const locator = getDescribedLocator(context, element) as any
        if (typeof locator._expect === 'function') {
          await locator._expect('to.be.attached', {
            isNot: false,
            timeout: 1, // don't wait when element doesn't exist
          })
        } else {
          await context.page.evaluate(() => 0)
        }
      } else {
        await context.page.evaluate(() => 0)
      }
    } catch {}
    await context.context.tracing.groupEnd()
    return
  }
  throw new TypeError(`The ${context.provider.name} provider does not support tracing.`)
}

export const groupTraceStart: BrowserCommand<[payload: { name: string; stack?: string }]> = async (
  context,
  payload,
) => {
  if (isPlaywrightProvider(context.provider)) {
    if (!context.provider.tracingContexts.has(context.sessionId)) {
      return
    }
    const { name, stack } = payload
    const location = parseLocation(context, stack)
    await context.context.tracing.group(name, { location })
    return
  }
  throw new TypeError(`The ${context.provider.name} provider does not support tracing.`)
}

export const groupTraceEnd: BrowserCommand<[]> = async (context) => {
  if (isPlaywrightProvider(context.provider)) {
    if (!context.provider.tracingContexts.has(context.sessionId)) {
      return
    }
    await context.context.tracing.groupEnd()
    return
  }
  throw new TypeError(`The ${context.provider.name} provider does not support tracing.`)
}

function parseLocation(context: BrowserCommandContext, stack?: string): ParsedStack | undefined {
  if (!stack) {
    return
  }
  const parsedStacks = context.project.browser!.parseStacktrace(stack)
  return parsedStacks[0]
}

const TRACE_EXTENSION = '.trace.zip'

// 255 minus the `-<sha1>.zip` suffix of the attachment copy
const MAX_TRACE_NAME_LENGTH = 255 - 45

function resolveTraceName(projectName: string, name: string) {
  const safeName = `${projectName}-${name}`.replace(/[^a-z0-9]/gi, '-')

  // keep repeat and retry counters after truncation
  const counters = safeName.match(/-\d+-\d+$/)?.[0] ?? ''
  const baseName = safeName.slice(0, safeName.length - counters.length)
  const hash = createHash('sha1').update(baseName).digest('hex').slice(0, 16)

  const truncated = truncateFileName(baseName, MAX_TRACE_NAME_LENGTH - counters.length, hash)
  return `${truncated}${counters}`
}

function resolveTracesPath({ testPath, project }: BrowserCommandContext, traceName: string) {
  if (!testPath) {
    throw new Error(`This command can only be called inside a test file.`)
  }
  const options = project.config.browser!.trace
  const fileName = `${traceName}${TRACE_EXTENSION}`
  if (options.tracesDir) {
    return resolve(options.tracesDir, fileName)
  }
  const dir = dirname(testPath)
  const base = basename(testPath)
  return resolve(dir, '__traces__', base, fileName)
}

export const deleteTracing: BrowserCommand<[{ traces: string[] }]> = async (
  context,
  { traces },
) => {
  if (!context.testPath) {
    throw new Error(`stopChunkTrace cannot be called outside of the test file.`)
  }
  if (isPlaywrightProvider(context.provider)) {
    for (const trace of traces) {
      assertBrowserApiWrite(context.project, trace)
      assertBrowserFileAccess(context.project, trace)
    }
    return Promise.all(
      traces.map((trace) =>
        unlink(trace).catch((err) => {
          if (err.code === 'ENOENT') {
            // Ignore the error if the file doesn't exist
            return
          }
          // Re-throw other errors
          throw err
        }),
      ),
    )
  }

  throw new Error(`provider ${context.provider.name} is not supported`)
}

export const annotateTraces: BrowserCommand<[{ traces: string[]; testId: string }]> = async (
  { project },
  { testId, traces },
) => {
  const vitest = project.vitest
  await Promise.all(
    traces.map((trace) => {
      assertBrowserApiWrite(project, trace)
      assertBrowserFileAccess(project, trace)
      const entity = vitest.state.getReportedEntityById(testId)
      const location = entity?.location
        ? {
            file: entity.module.moduleId,
            line: entity.location.line,
            column: entity.location.column,
          }
        : undefined
      return vitest._testRun.recordArtifact(testId, {
        type: 'internal:annotation',
        annotation: {
          message: basename(trace, TRACE_EXTENSION),
          type: 'traces',
          attachment: {
            path: trace,
            contentType: 'application/octet-stream',
          },
          location,
        },
        location,
      })
    }),
  )
}

function isPlaywrightProvider(provider: BrowserProvider): provider is PlaywrightBrowserProvider {
  return provider.name === 'playwright'
}
