import type {
  NonStandardScreenshotComparators,
  ScreenshotComparatorRegistry,
  ScreenshotMatcherOptions,
} from '@vitest/browser/context'

interface BaseMetadata { height: number; width: number }
export type TypedArray
  = | Buffer<ArrayBufferLike>
    | Uint8Array<ArrayBufferLike>
    | Uint8ClampedArray<ArrayBufferLike>
export type Promisable<T> = T | Promise<T>

export interface Codec<
  DecoderOptions extends object,
  DecoderMetadata extends object,
  EncoderOptions extends object,
> {
  decode: (
    buffer: TypedArray,
    options: DecoderOptions,
  ) => Promisable<{
    data: TypedArray
    metadata: DecoderMetadata & BaseMetadata
  }>
  encode: (
    image: { data: TypedArray; metadata: BaseMetadata },
    options: EncoderOptions,
  ) => Promisable<TypedArray>
}

export type Comparator<Options extends Record<string, unknown>> = (
  reference: {
    metadata: BaseMetadata
    data: TypedArray
  },
  actual: {
    metadata: BaseMetadata
    data: TypedArray
  },
  options: {
    /**
     * Allows the comparator to create a diff image.
     *
     * Note that the comparator might choose to ignore the flag, so a diff image is not guaranteed.
     */
    createDiff: boolean
  } & Options,
) => Promisable<{ pass: boolean; diff: TypedArray | null; message: string | null }>

type CustomComparatorsToRegister = {
  [Key in keyof NonStandardScreenshotComparators]: Comparator<NonStandardScreenshotComparators[Key]>
}

export type CustomComparatorsRegistry
  = keyof CustomComparatorsToRegister extends never
    ? { comparators?: Record<string, Comparator<Record<string, unknown>>> }
    : { comparators: CustomComparatorsToRegister }

declare module 'vitest/node' {
  export interface ToMatchScreenshotOptions
    extends Omit<
      ScreenshotMatcherOptions,
      'comparatorName' | 'comparatorOptions'
    >, CustomComparatorsRegistry {}

  export interface ToMatchScreenshotComparators
    extends ScreenshotComparatorRegistry {}
}
