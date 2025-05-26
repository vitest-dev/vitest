import type { BrowserCommand } from 'vitest/node'
import type { ResolvedScreenshotCompareOptions, ScreenshotCompareResult } from '../../../context'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { dirname, isAbsolute, normalize, resolve } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { takeScreenshot } from './screenshot'

export const screenshotCompare: BrowserCommand<[ResolvedScreenshotCompareOptions]> = async (
  context,
  options,
): Promise<ScreenshotCompareResult> => {
  if (!context.testPath) {
    throw new Error(`Cannot take a screenshot without a test path`)
  }

  if (!options.baselinePath) {
    throw new Error(`Baseline path not provided`)
  }

  const baselinePath = isAbsolute(options.baselinePath)
    ? normalize(options.baselinePath)
    : normalize(resolve(dirname(context.testPath), options.baselinePath))

  await rm(options.diffPath, { force: true })

  if (!existsSync(baselinePath) || options.updateBaselines) {
    await takeScreenshot(context, { element: options.element, save: true }, baselinePath)
    return { pass: true, diff: 0, written: true, message: `Baseline screenshot saved to ${baselinePath}` }
  }

  const baselineBuffer = await readFile(baselinePath)
  const currentBuffer = await takeScreenshot(context, { element: options.element, save: false })

  return await comparePNGs(baselineBuffer, currentBuffer, options)
}

async function comparePNGs(
  baselineBuffer: Buffer,
  currentBuffer: Buffer,
  options: ResolvedScreenshotCompareOptions,
): Promise<ScreenshotCompareResult> {
  const baselineImage = PNG.sync.read(baselineBuffer)
  const currentImage = PNG.sync.read(currentBuffer)

  if (baselineImage.width !== currentImage.width || baselineImage.height !== currentImage.height) {
    // TODO Handle resizing image
    return {
      diff: 0,
      written: false,
      pass: false,
      message: `Image dimensions do not match: baseline (${baselineImage.width}x${baselineImage.height}) vs current (${currentImage.width}x${currentImage.height})`,
    }
  }

  const { width, height } = baselineImage
  const diff = new PNG({ width, height })

  // TODO: Add baseline and current images to the sides of the diff image
  const numDiffPixels = pixelmatch(
    baselineImage.data,
    currentImage.data,
    diff.data,
    width,
    height,
    { threshold: options.pixelMatchThreshold },
  )

  // TODO Support the percentage threshold
  if (numDiffPixels > options.failureThreshold) {
    await mkdir(dirname(options.diffPath), { recursive: true })
    await writeFile(options.diffPath, PNG.sync.write(diff))
    return {
      message: `Images differ by ${numDiffPixels} pixels. Diff image written to ${options.diffPath}`,
      pass: false,
      diff: numDiffPixels,
      written: false,
    }
  }

  return {
    pass: true,
    diff: numDiffPixels,
    written: false,
    message: `Images match with a difference of ${numDiffPixels} pixels.`,
  }
}
