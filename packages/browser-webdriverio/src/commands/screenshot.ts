import type { ScreenshotOptions } from 'vitest/browser'
import type { BrowserCommandContext } from 'vitest/node'
import crypto from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import { normalize as platformNormalize } from 'node:path'
import { resolveScreenshotPath } from '@vitest/browser'
import { dirname, normalize, resolve } from 'pathe'

interface ScreenshotCommandOptions extends Omit<ScreenshotOptions, 'element' | 'mask'> {
  element?: string
  mask?: readonly string[]
}

/**
 * Takes a screenshot using the provided browser context and returns a buffer and the expected screenshot path.
 *
 * **Note**: the returned `path` indicates where the screenshot *might* be found.
 * It is not guaranteed to exist, especially if `options.save` is `false`.
 *
 * @throws {Error} If the function is not called within a test or if the browser provider does not support screenshots.
 */
export async function takeScreenshot(
  context: BrowserCommandContext,
  name: string,
  options: Omit<ScreenshotCommandOptions, 'base64'>,
): Promise<{ buffer: Buffer<ArrayBufferLike>; path: string }> {
  if (!context.testPath) {
    throw new Error(`Cannot take a screenshot without a test path`)
  }

  const path = resolveScreenshotPath(
    context.testPath,
    name,
    context.project.config,
    options.path,
  )

  // playwright does not need a screenshot path if we don't intend to save it
  let savePath: string | undefined

  if (options.save) {
    savePath = normalize(path)

    await mkdir(dirname(savePath), { recursive: true })
  }

  // webdriverio needs a path, so if one is not already set we create a temporary one
  if (savePath === undefined) {
    savePath = resolve(context.project.tmpDir, crypto.randomUUID())

    await mkdir(context.project.tmpDir, { recursive: true })
  }

  const page = context.browser
  const element = !options.element
    ? await page.$('body')
    : await page.$(`${options.element}`)

  // webdriverio expects the path to contain the extension and only works with PNG files
  const savePathWithExtension = savePath.endsWith('.png') ? savePath : `${savePath}.png`

  // there seems to be a bug in webdriverio, `X:/` gets appended to cwd, so we convert to `X:\`
  const buffer = await element.saveScreenshot(
    platformNormalize(savePathWithExtension),
  )
  if (!options.save) {
    await rm(savePathWithExtension, { force: true })
  }
  return { buffer, path }
}
