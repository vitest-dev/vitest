import type { SnapshotUpdateState } from 'vitest'
import type { ScreenshotMatcherOptions } from 'vitest/browser'
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node'
import type { ScreenshotMatcherArguments, ScreenshotMatcherOutput } from '../../../shared/screenshotMatcher/types'
import type { AnyCodec } from './codecs'
import type { AnyComparator } from './comparators'
import type { TypedArray } from './types'
import type { ResolvedOptions } from './utils'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'pathe'
import { asyncTimeout, resolveOptions, takeDecodedScreenshot } from './utils'

/** Decoded image data with dimensions metadata. */
type DecodedImage = Awaited<ReturnType<AnyCodec['decode']>>

/** Bundle of an image with its filesystem path. */
interface ScreenshotData {
  image: DecodedImage
  path: string
}

/**
 * Discriminated union representing all possible outcomes of a screenshot comparison.
 *
 * Each variant is self-contained with the data needed for side effects and output building.
 *
 * - `unstable-screenshot`: page never stabilized within timeout
 * - `missing-reference`: no baseline exists to compare against
 * - `update-reference`: snapshot update was requested (run with `--update`)
 * - `matched-immediately`: screenshot matched reference on first capture (no retries)
 * - `matched-after-comparison`: screenshot matched after another comparison
 * - `mismatch`: screenshot differs from reference
 */
type MatchOutcome
  = | {
    type: 'unstable-screenshot'
    reference: ScreenshotData | null
  }
  | {
    type: 'missing-reference'
    location: 'reference' | 'diffs'
    reference: ScreenshotData
  }
  | {
    type: 'update-reference'
    reference: ScreenshotData
  }
  | { type: 'matched-immediately' }
  | { type: 'matched-after-comparison' }
  | {
    type: 'mismatch'
    reference: ScreenshotData
    actual: ScreenshotData
    diff: ScreenshotData | null
    message: string | null
  }

/**
 * Browser command that compares a screenshot against a stored reference.
 *
 * The comparison workflow is organized as follows:
 *
 * 1. Load existing reference (if any)
 * 2. Capture a stable screenshot (retrying until the page stops changing)
 * 3. Determine the outcome based on capture results and update settings
 * 4. Write any necessary files (new references, diffs)
 * 5. Return result for the test runner
 */
export const screenshotMatcher: BrowserCommand<ScreenshotMatcherArguments> = async (
  context,
  name,
  testName,
  options,
): ScreenshotMatcherOutput => {
  if (!context.testPath) {
    throw new Error('Cannot compare screenshots without a test path')
  }

  const { element } = options
  const {
    codec,
    comparator,
    paths,
    resolvedOptions: { comparatorOptions, screenshotOptions, timeout },
  } = resolveOptions({ context, name, testName, options })

  const referenceFile = await readFile(paths.reference).catch(() => null)
  const reference = referenceFile && await codec.decode(referenceFile, {})

  const screenshotResult = await waitForStableScreenshot({
    codec,
    comparator,
    comparatorOptions,
    context,
    element,
    name: `${Date.now()}-${basename(paths.reference)}`,
    reference,
    screenshotOptions,
  }, timeout)

  const outcome = await determineOutcome({
    reference,
    screenshot: screenshotResult && screenshotResult.actual,
    retries: screenshotResult?.retries ?? 0,
    updateSnapshot: context.project.serializedConfig.snapshotOptions.updateSnapshot,
    paths,
    comparator,
    comparatorOptions,
  })

  await performSideEffects(outcome, codec)

  return buildOutput(outcome, timeout)
}

/**
 * Core comparison logic that produces a {@linkcode MatchOutcome}.
 *
 * All branching logic lives here. This is the single source of truth for "what happened".
 *
 * The outcome carries all data needed by {@linkcode performSideEffects} and {@linkcode buildOutput}.
 */
async function determineOutcome(
  {
    comparator,
    comparatorOptions,
    paths,
    reference,
    retries,
    screenshot,
    updateSnapshot,
  }: Pick<ResolvedOptions, 'comparator' | 'paths'> & {
    comparatorOptions: ResolvedOptions['resolvedOptions']['comparatorOptions']
    reference: DecodedImage | null
    retries: number
    screenshot: DecodedImage | null
    updateSnapshot: SnapshotUpdateState
  },
): Promise<MatchOutcome> {
  if (screenshot === null) {
    return {
      type: 'unstable-screenshot',
      reference: reference && {
        image: reference,
        path: paths.reference,
      },
    }
  }

  // no reference to compare against - create one based on update settings
  if (reference === null) {
    if (updateSnapshot === 'all') {
      return {
        type: 'update-reference',
        reference: {
          image: screenshot,
          path: paths.reference,
        },
      }
    }

    const location = updateSnapshot === 'none'
      ? 'diffs'
      : 'reference'

    return {
      type: 'missing-reference',
      location,
      reference: {
        image: screenshot,
        path: location === 'reference'
          ? paths.reference
          : paths.diffs.reference,
      },
    }
  }

  // first capture matched reference (used as baseline) - no further comparison needed
  if (retries === 0) {
    return { type: 'matched-immediately' }
  }

  const comparisonResult = await comparator(
    reference,
    screenshot,
    { createDiff: true, ...comparatorOptions },
  )

  if (comparisonResult.pass) {
    return { type: 'matched-after-comparison' }
  }

  if (updateSnapshot === 'all') {
    return {
      type: 'update-reference',
      reference: {
        image: screenshot,
        path: paths.reference,
      },
    }
  }

  return {
    type: 'mismatch',
    reference: {
      image: reference,
      path: paths.reference,
    },
    actual: {
      image: screenshot,
      path: paths.diffs.actual,
    },
    diff: comparisonResult.diff && {
      image: {
        data: comparisonResult.diff,
        // `comparator` only returns pixel data; diff dimensions always match reference
        metadata: reference.metadata,
      },
      path: paths.diffs.diff,
    },
    message: comparisonResult.message,
  }
}

/**
 * Writes files to disk based on the outcome.
 *
 * Only `missing-reference`, `update-reference`, and `mismatch` write files. Successful matches produce no side effects.
 */
async function performSideEffects(
  outcome: MatchOutcome,
  codec: AnyCodec,
): Promise<void> {
  switch (outcome.type) {
    case 'missing-reference':
    case 'update-reference': {
      await writeScreenshot(
        outcome.reference.path,
        await codec.encode(outcome.reference.image, {}),
      )

      break
    }

    case 'mismatch': {
      await writeScreenshot(
        outcome.actual.path,
        await codec.encode(outcome.actual.image, {}),
      )

      if (outcome.diff) {
        await writeScreenshot(
          outcome.diff.path,
          await codec.encode(outcome.diff.image, {}),
        )
      }

      break
    }
  }
}

/**
 * Transforms a {@linkcode MatchOutcome} into the output format expected by the test runner.
 *
 * Maps each outcome to a pass/fail result with metadata and error messages.
 */
function buildOutput(
  outcome: MatchOutcome,
  timeout: number,
): Awaited<ScreenshotMatcherOutput> {
  switch (outcome.type) {
    case 'unstable-screenshot':
      return {
        pass: false,
        reference: outcome.reference && {
          path: outcome.reference.path,
          width: outcome.reference.image.metadata.width,
          height: outcome.reference.image.metadata.height,
        },
        actual: null,
        diff: null,
        message: `Could not capture a stable screenshot within ${timeout}ms.`,
      }

    case 'missing-reference': {
      return {
        pass: false,
        reference: {
          path: outcome.reference.path,
          width: outcome.reference.image.metadata.width,
          height: outcome.reference.image.metadata.height,
        },
        actual: null,
        diff: null,
        message: outcome.location === 'reference'
          ? 'No existing reference screenshot found; a new one was created. Review it before running tests again.'
          : 'No existing reference screenshot found.',
      }
    }

    case 'update-reference':
    case 'matched-immediately':
    case 'matched-after-comparison':
      return { pass: true }

    case 'mismatch':
      return {
        pass: false,
        reference: {
          path: outcome.reference.path,
          width: outcome.reference.image.metadata.width,
          height: outcome.reference.image.metadata.height,
        },
        actual: {
          path: outcome.actual.path,
          width: outcome.actual.image.metadata.width,
          height: outcome.actual.image.metadata.height,
        },
        diff: outcome.diff && {
          path: outcome.diff.path,
          width: outcome.diff.image.metadata.width,
          height: outcome.diff.image.metadata.height,
        },
        message: `Screenshot does not match the stored reference.${
          outcome.message ? `\n${outcome.message}` : ''
        }`,
      }

    default: {
      // exhaustiveness check - TypeScript will error if a case is unhandled
      outcome satisfies never

      return {
        pass: false,
        actual: null,
        reference: null,
        diff: null,
        message: `Outcome (${(outcome as MatchOutcome).type}) not handled. This is a bug in Vitest. Please, open an issue with reproduction.`,
      }
    }
  }
}

/** Configuration for stable screenshot capture. */
interface StableScreenshotOptions {
  codec: AnyCodec
  comparator: AnyComparator
  comparatorOptions: ScreenshotMatcherOptions['comparatorOptions']
  context: BrowserCommandContext
  element: string
  name: string
  reference: ReturnType<AnyCodec['decode']> | null
  screenshotOptions: ScreenshotMatcherArguments[2]['screenshotOptions']
}

/**
 * Captures a stable screenshot with timeout handling.
 *
 * Wraps {@linkcode getStableScreenshot} with an abort controller that triggers when the timeout expires. Returns `null` if the page never stabilizes.
 */
async function waitForStableScreenshot(options: StableScreenshotOptions, timeout: number,
): Promise<{ actual: DecodedImage; retries: number } | null> {
  const abortController = new AbortController()

  const stableScreenshot = getStableScreenshot(
    options,
    abortController.signal,
  )

  const result = await (
    timeout === 0
      ? stableScreenshot
      : Promise.race([
          stableScreenshot,
          asyncTimeout(timeout).finally(() => abortController.abort()),
        ])
  )

  return result
}

/**
 * Takes screenshots repeatedly until the page reaches a visually stable state.
 *
 * This function compares consecutive screenshots and continues taking new ones until two consecutive screenshots match according to the provided comparator.
 *
 * The process works as follows:
 *
 * 1. Uses as baseline an optional reference screenshot or takes a new screenshot
 * 2. Takes a screenshot and compares with baseline
 * 3. If they match, the page is considered stable and the function returns
 * 4. If they don't match, it continues with the newer screenshot as the baseline
 * 5. Repeats until stability is achieved or the operation is aborted
 *
 * @returns `Promise` resolving to an object containing the retry count and final screenshot
 */
async function getStableScreenshot({
  codec,
  context,
  comparator,
  comparatorOptions,
  element,
  name,
  reference,
  screenshotOptions,
}: StableScreenshotOptions, signal: AbortSignal): Promise<{
  retries: number
  actual: DecodedImage
}> {
  const screenshotArgument = {
    codec,
    context,
    element,
    name,
    screenshotOptions,
  } satisfies Parameters<typeof takeDecodedScreenshot>[0]

  let retries = 0

  let decodedBaseline = reference

  while (signal.aborted === false) {
    if (decodedBaseline === null) {
      decodedBaseline = takeDecodedScreenshot(screenshotArgument)
    }

    const [image1, image2] = await Promise.all([
      decodedBaseline,
      takeDecodedScreenshot(screenshotArgument),
    ])

    const isStable = (await comparator(
      image1,
      image2,
      { ...comparatorOptions, createDiff: false },
    )).pass

    decodedBaseline = image2

    if (isStable) {
      break
    }

    retries += 1
  }

  return {
    retries,
    actual: await decodedBaseline!,
  }
}

/** Writes encoded images to disk, creating parent directories as needed. */
async function writeScreenshot(path: string, image: TypedArray) {
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, image)
  }
  catch (cause) {
    throw new Error('Couldn\'t write file to fs', { cause })
  }
}
