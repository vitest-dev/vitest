import type { ScreenshotComparatorRegistry, ScreenshotMatcherOptions } from '../../../context'

export type ScreenshotMatcherArguments<
  ComparatorName extends keyof ScreenshotComparatorRegistry = keyof ScreenshotComparatorRegistry,
> = [
  name: string,
  testName: string,
  options: ScreenshotMatcherOptions<ComparatorName> & { element: string },
]

export type ScreenshotMatcherOutput = Promise<
  {
    pass: false
    reference: string | null
    actual: string | null
    diff: string | null
    message: string
  } |
  {
    pass: true
  }
>
