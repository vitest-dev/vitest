import png from './png'

export function getCodec(type: 'png'): typeof png

export function getCodec(type: string) {
  switch (type) {
    case 'png':
      return png

    default:
      throw new Error(`No codec found for type ${type}`)
  }
}

export type AnyCodec = typeof png
