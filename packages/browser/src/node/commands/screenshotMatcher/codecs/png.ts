import type { Metadata, PackerOptions, ParserOptions } from 'pngjs'
import type { Codec } from '../types'
import { PNG } from 'pngjs'

const codec: Codec<ParserOptions, Metadata, PackerOptions> = {
  decode: (buffer, options) => {
    const {
      data,
      alpha,
      bpp,
      color,
      colorType,
      depth,
      height,
      interlace,
      palette,
      width,
    } = PNG.sync.read(
      Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
      options,
    )

    return {
      metadata: {
        alpha,
        bpp,
        color,
        colorType,
        depth,
        height,
        interlace,
        palette,
        width,
      },
      data,
    }
  },
  encode: ({ data, metadata: { height, width } }, options) => {
    const png = new PNG({
      height,
      width,
    })

    png.data = Buffer.isBuffer(data) ? data : Buffer.from(data)

    return PNG.sync.write(png, options)
  },
}

export default codec
