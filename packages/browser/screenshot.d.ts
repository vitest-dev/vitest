import type pm from 'pixelmatch'

export interface ScreenshotOptions {
  element?: Element | Locator
  /**
   * Path relative to the current test file.
   * @default `__screenshots__/${testFileName}/${testName}.png`
   */
  path?: string
  /**
   * Will also return the base64 encoded screenshot alongside the path.
   */
  base64?: boolean
  /**
   * Keep the screenshot on the file system. If file is not saved,
   * `page.screenshot` always returns `base64` screenshot.
   * @default true
   */
  save?: boolean
}

export type TypedArray = Buffer<ArrayBufferLike> | Uint8Array<ArrayBufferLike> | Uint8ClampedArray<ArrayBufferLike>
export type Promisable<T> = T | Promise<T>

export type Comparator<Options extends Record<string, unknown>> = (reference: {
  metadata: { height: number; width: number }
  data: TypedArray
}, actual: {
  metadata: { height: number; width: number }
  data: TypedArray
}, options: {
  /**
   * Allows the comparator to create a diff image.
   *
   * Note that the comparator might choose to ignore the flag, so a diff image is not guaranteed.
   */
  createDiff: boolean
} & Options) => Promisable<{ pass: boolean; diff: TypedArray | null }>

export interface Comparators {
  pixelmatch: {
    // @todo percentage-based threshold
    options: NonNullable<Parameters<typeof pm>['5']>;
    instance: Comparator<Comparators['pixelmatch']['options']>
  }
}

export interface ScreenshotMatcherOptions<Comparator extends keyof Comparators = keyof Comparators> {
  comparatorOptions: {
    name: Comparator
  } & Comparators[Comparator]['options']
  screenshotOptions: Omit<ScreenshotOptions, 'element' | 'base64' | 'save' | 'type'>
  /**
   * Time to wait until a stable screenshot is found.
   *
   * Setting this value to `0` disables the timeout, but if a stable screenshot
   * can't be determined the process will not end.
   *
   * @default 5000
   */
  timeout?: number
}
