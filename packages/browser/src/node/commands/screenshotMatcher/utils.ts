import type { BrowserCommandContext, BrowserConfigOptions } from 'vitest/node'
import type { ScreenshotMatcherOptions } from '../../../../context'
import type { AnyCodec } from './codecs'
import { platform } from 'node:os'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { deepMerge } from '@vitest/utils'
import { takeScreenshot } from '../screenshot'
import { getCodec } from './codecs'
import { getComparator } from './comparators'

type GlobalOptions = Required<
  NonNullable<
    NonNullable<BrowserConfigOptions['expect']>['toMatchScreenshot']
  >
>

const defaultOptions = {
  comparatorName: 'pixelmatch',
  // these are handled by each comparator on its own
  comparatorOptions: {},
  screenshotOptions: {
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    maskColor: '#ff00ff',
    omitBackground: false,
    scale: 'css',
  },
  timeout: 5_000,
  resolveDiffPath: ({
    arg,
    ext,
    root,
    attachmentsDir,
    browserName,
    testFileDirectory,
    testFileName,
  }) => resolve(
    root,
    attachmentsDir,
    testFileDirectory,
    testFileName,
    `${arg}-${browserName}${ext}`,
  ),
  resolveScreenshotPath: ({
    arg,
    ext,
    root,
    screenshotDirectory,
    testFileDirectory,
    testFileName,
    browserName,
  }) => resolve(
    root,
    testFileDirectory,
    screenshotDirectory,
    testFileName,
    `${arg}-${browserName}${ext}`,
  ),
} satisfies GlobalOptions

type SupportedCodecs = Parameters<typeof getCodec>[0]

const supportedExtensions = ['png'] satisfies SupportedCodecs[]

export function resolveOptions(
  {
    context,
    name,
    options,
    testName,
  }: {
    context: BrowserCommandContext
    name: string
    testName: string
    options: ScreenshotMatcherOptions
  },
): {
    codec: ReturnType<typeof getCodec>
    comparator: ReturnType<typeof getComparator>
    resolvedOptions: GlobalOptions
    paths: {
      reference: string
      diffs: {
        reference: string
        actual: string
        diff: string
      }
    }
  } {
  if (context.testPath === undefined) {
    throw new Error('`resolveOptions` has to be used in a test file')
  }

  const resolvedOptions = deepMerge<GlobalOptions>(
    Object.create(null),
    defaultOptions,
    context.project.config.browser.expect?.toMatchScreenshot ?? {},
    options,
  )

  const extensionFromName = extname(name)

  // technically the type is a lie, but we check beneath and reassign otherwise
  let extension = extensionFromName.replace(/^\./, '') as SupportedCodecs

  // when `type` will be supported in `screenshotOptions`:
  // - `'png'` should end up in `defaultOptions.screenshotOptions.type`
  // - this condition should be switched around
  // - the assignment should be `resolvedOptions.screenshotOptions.type = extension`
  // - everything using `extension` should use `resolvedOptions.screenshotOptions.type`
  if (supportedExtensions.includes(extension) === false) {
    extension = 'png'
  }

  const { root } = context.project.serializedConfig

  const resolvePathData = {
    arg: sanitizeArg(
      // remove the extension only if it ends up being used
      extensionFromName.endsWith(extension)
        ? basename(name, extensionFromName)
        : name,
    ),
    ext: `.${extension}`,
    platform: platform(),
    root,
    screenshotDirectory: relative(
      root,
      join(root, context.project.config.browser.screenshotDirectory ?? '__screenshots__'),
    ),
    attachmentsDir: relative(root, context.project.config.attachmentsDir),
    testFileDirectory: relative(root, dirname(context.testPath)),
    testFileName: basename(context.testPath),
    testName: sanitize(testName, false),
    browserName: context.project.config.browser.name,
  } satisfies Parameters<GlobalOptions['resolveDiffPath']>[0]

  return {
    codec: getCodec(extension),
    // @ts-expect-error should get fixed by changing the config types
    comparator: getComparator(resolvedOptions.comparatorName),
    resolvedOptions,
    paths: {
      reference: resolvedOptions.resolveScreenshotPath(resolvePathData),
      // lazily initialize this, as it might not be needed at all
      get diffs() {
        const diffs = {
          reference: resolvedOptions.resolveDiffPath({
            ...resolvePathData,
            arg: `${resolvePathData.arg}-reference`,
          }),
          actual: resolvedOptions.resolveDiffPath({
            ...resolvePathData,
            arg: `${resolvePathData.arg}-actual`,
          }),
          diff: resolvedOptions.resolveDiffPath({
            ...resolvePathData,
            arg: `${resolvePathData.arg}-diff`,
          }),
        }

        // @ts-expect-error we set the value back right beneath
        delete this.diffs
        this.diffs = diffs

        return diffs
      },
    },
  }
}

/**
 * Sanitizes a string by removing or transforming characters to ensure it is
 * safe for use as a filename or path segment. It supports two modes:
 *
 * 1. Non-path mode (`keepPaths === false`):
 *    - Replaces one or more whitespace characters (`\s+`) with a single hyphen (`-`).
 *    - Removes any character that is not a word character (`\w`) or a hyphen (`-`).
 *    - Collapses multiple consecutive hyphens (`-{2,}`) into a single hyphen.
 *
 * 2. Path-preserving mode (`keepPaths === true`):
 *    - Splits the input string on the platform-specific path separator ({@linkcode sep}).
 *    - Sanitizes each path segment individually in non-path mode.
 *    - Joins the sanitized segments back together using the same {@linkcode sep}.
 *
 * @param input - The raw string to sanitize.
 * @param keepPaths - If `false`, performs a flat sanitization (drops path segments).
 * If `true`, treats `input` as a path: each segment is sanitized independently,
 * preserving separators.
 */
function sanitize(input: string, keepPaths: boolean): string {
  if (keepPaths === false) {
    return input
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/-{2,}/g, '-')
  }

  return input.split(sep).map(path => sanitize(path, false)).join(sep)
}

/**
 * Takes a string, treats it as a potential path or filename, and ensures it cannot
 * escape the root directory or contain invalid characters. Internally, it:
 *
 * 1. Prepends the platform-specific separator ({@linkcode sep}) to the raw input
 * to form a path-like string.
 * 2. Uses {@linkcode relative|relative(sep, <that-path>)} to compute a relative
 * path from the root ({@linkcode sep}), which effectively strips any leading
 * separators and prevents traversal above the root.
 * 3. Passes the resulting relative path into {@linkcode sanitize|sanitize(..., true)},
 * preserving any path separators but sanitizing each segment.
 *
 * @param input - The raw string to clean.
 */
function sanitizeArg(input: string): string {
  return sanitize(relative(sep, join(sep, input)), true)
}

/**
 * Takes a screenshot and decodes it using the provided codec.
 *
 * The screenshot is taken as a base64 string and then decoded into the format
 * expected by the comparator.
 *
 * @returns `Promise` resolving to the decoded screenshot data
 */
export function takeDecodedScreenshot({
  codec,
  context,
  element,
  name,
  screenshotOptions,
}: {
  codec: AnyCodec
  context: BrowserCommandContext
  element: string
  name: string
  screenshotOptions: ScreenshotMatcherOptions['screenshotOptions']
}): ReturnType<AnyCodec['decode']> {
  return takeScreenshot(
    context,
    name,
    { ...screenshotOptions, save: false, element },
  ).then(
    ({ buffer }) => codec.decode(buffer, {}),
  )
}

/**
 * Creates a promise that resolves to `null` after the specified timeout.
 * If the timeout is `0`, the promise resolves immediately.
 *
 * @param timeout - The delay in milliseconds before the promise resolves
 * @returns `Promise` that resolves to `null` after the timeout
 */
export function asyncTimeout(timeout: number): Promise<null> {
  return new Promise((resolve) => {
    if (timeout === 0) {
      resolve(null)
    }
    else {
      setTimeout(() => resolve(null), timeout)
    }
  })
}
