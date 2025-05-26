import type { Comparator, Promisable, TypedArray } from '../../../../../screenshot'

type BaseMetadata = Parameters<Comparator<any>>[0]['metadata']

export interface Codec<
  DecoderOptions extends object,
  DecoderMetadata extends object,
  EncoderOptions extends object,
> {
  decode: (
    buffer: TypedArray,
    options: DecoderOptions
  ) => Promisable<{
    data: TypedArray
    metadata: DecoderMetadata & BaseMetadata
  }>
  encode: (
    image: { data: TypedArray; metadata: BaseMetadata },
    options: EncoderOptions
  ) => Promisable<TypedArray>
}
