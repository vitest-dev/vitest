import type { BrowserCommand, BrowserCommandContext } from 'vitest/node'
import type { ScreenshotMatcherOptions } from '../../../../context'
import type { ScreenshotMatcherArguments, ScreenshotMatcherOutput } from '../../../shared/screenshotMatcher/types'
import type { AnyCodec } from './codecs'
import type { AnyComparator } from './comparators'
import type { TypedArray } from './types'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { asyncTimeout, resolveOptions, takeDecodedScreenshot } from './utils'

// @todo if reporter is HTML, for convenience it would be great to write reference in its output folder
// @todo wrap `screenshotMatcher` with a function that checks result and copies reference

export const screenshotMatcher: BrowserCommand<
  ScreenshotMatcherArguments
> = async (context, name, testName, options): ScreenshotMatcherOutput => {
  if (!context.testPath) {
    throw new Error(`Cannot compare screenshots without a test path`)
  }

  const { element } = options

  const {
    codec,
    comparator,
    paths,
    resolvedOptions: { comparatorOptions, screenshotOptions, timeout },
  } = resolveOptions({ context, name, testName, options })

  const hasReference = await access(paths.reference).then(() => true).catch(() => false)
  const reference = hasReference
    ? await codec.decode(await readFile(paths.reference), {})
    : null

  const abortController = new AbortController()
  const stableScreenshot = getStableScreenshots({
    codec,
    comparator,
    comparatorOptions,
    context,
    element,
    name,
    reference,
    screenshotOptions,
    signal: abortController.signal,
  })

  const value = await (
    timeout === 0
      ? stableScreenshot
      : Promise.race([
          stableScreenshot,
          asyncTimeout(timeout).finally(() => { abortController.abort() }),
        ])
  )

  // case #01
  //  - impossible to get a stable screenshot to compare against
  //  - fail
  if (value === null || value.actual === null) {
    return {
      pass: false,
      reference: hasReference ? paths.reference : null,
      actual: null,
      diff: null,
      message: `Could not capture a stable screenshot within ${timeout}ms.`,
    }
  }

  const { updateSnapshot } = context.project.serializedConfig.snapshotOptions

  // if there's no reference or if we want to update snapshots, we have to finish the comparison early
  if (reference === null || updateSnapshot === 'all') {
    const shouldCreateReference = updateSnapshot !== 'none'
    const referencePath = shouldCreateReference ? paths.reference : paths.diffs.reference

    await writeScreenshot(
      referencePath,
      await codec.encode(value.actual, {}),
    )

    // case #02
    //  - got a stable screenshot, but there is no reference and we don't want to update screenshots
    //  - fail
    if (updateSnapshot !== 'all') {
      return {
        pass: false,
        reference: referencePath,
        actual: null,
        diff: null,
        message: `No existing reference screenshot found${
          shouldCreateReference
            ? '; a new one was created. Review it before running tests again.'
            : '.'
        }`,
      }
    }

    // case #03
    //  - got a stable screenshot, there is no reference, but we want to update screenshots
    //  - pass
    return {
      pass: true,
    }
  }

  // case #04
  //  - got a stable screenshot with no retries and there's a reference
  //  - pass
  if (hasReference && value.retries === 0) {
    return {
      pass: true,
    }
  }

  const finalResult = await comparator(reference, value.actual, { createDiff: true, ...comparatorOptions })

  if (finalResult.pass === false && finalResult.diff !== null) {
    const diff = await codec.encode(
      {
        data: finalResult.diff,
        metadata: {
          height: reference.metadata.height,
          width: reference.metadata.width,
        },
      },
      {},
    )

    await writeScreenshot(paths.diffs.diff, diff)
  }

  // case #05
  //  - reference matches stable screenshot
  //  - pass
  if (finalResult.pass === true) {
    return {
      pass: true,
    }
  }

  const actual = await codec.encode(value.actual, {})

  await writeScreenshot(paths.diffs.actual, actual)

  // case #06
  //  - fallback, reference does NOT match stable screenshot
  //  - fail
  return {
    pass: false,
    reference: paths.reference,
    actual: paths.diffs.actual,
    diff: finalResult.diff && paths.diffs.diff,
    message: `Screenshot does not match the stored reference.${
      finalResult.message === null
        ? ''
        : `\n${finalResult.message}`
    }`,
  }
}

async function writeScreenshot(path: string, image: TypedArray) {
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, image)
  }
  catch {
    throw new Error('Couldn\'t write file to fs')
  }
}

/**
 * Takes screenshots repeatedly until the page reaches a visually stable state.
 *
 * This function compares consecutive screenshots and continues taking new ones
 * until two consecutive screenshots match according to the provided comparator.
 *
 * The process works as follows:
 *
 * 1. Uses as baseline an optional reference screenshot or takes a new screenshot
 * 2. Takes a screenshot and compares with baseline
 * 3. If they match, the page is considered stable and the function returns
 * 4. If they don't match, it continues with the newer screenshot as the baseline
 * 5. Repeats until stability is achieved or the operation is aborted
 *
 * @returns `Promise` resolving to an object containing the retry count and
 * final screenshot
 */
async function getStableScreenshots({
  codec,
  context,
  comparator,
  comparatorOptions,
  element,
  name,
  reference,
  screenshotOptions,
  signal,
}: {
  codec: AnyCodec
  comparator: AnyComparator
  comparatorOptions: ScreenshotMatcherOptions['comparatorOptions']
  context: BrowserCommandContext
  element: string
  name: string
  reference: ReturnType<AnyCodec['decode']> | null
  screenshotOptions: ScreenshotMatcherOptions['screenshotOptions']
  signal: AbortSignal
}) {
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

    const comparatorResult = (await comparator(
      image1,
      image2,
      { ...comparatorOptions, createDiff: false },
    )).pass

    decodedBaseline = image2

    if (comparatorResult) {
      break
    }

    retries += 1
  }

  return {
    retries,
    actual: await decodedBaseline,
  }
}
