import type { ScreenshotComparatorRegistry, ScreenshotMatcherOptions } from '../../../context'

export type ScreenshotMatcherArguments<
  ComparatorName extends keyof ScreenshotComparatorRegistry = keyof ScreenshotComparatorRegistry,
> = [
  name: string,
  testName: string,
  options: ScreenshotMatcherOptions<ComparatorName>
    & {
      element: string
      screenshotOptions?: ScreenshotMatcherOptions<ComparatorName>['screenshotOptions'] & { mask?: readonly string[] }
    },
]

interface ScreenshotData { path: string; metadata: { width: number; height: number } }

export type ScreenshotMatcherOutput = Promise<
  {
    pass: false
    reference: ScreenshotData | null
    actual: ScreenshotData | null
    diff: string | null
    message: string
  }
  | {
    pass: true
  }
>
