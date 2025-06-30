export const KNOWN_ASSET_TYPES: string[] = [
  // images
  'apng',
  'bmp',
  'png',
  'jpe?g',
  'jfif',
  'pjpeg',
  'pjp',
  'gif',
  'svg',
  'ico',
  'webp',
  'avif',

  // media
  'mp4',
  'webm',
  'ogg',
  'mp3',
  'wav',
  'flac',
  'aac',

  // fonts
  'woff2?',
  'eot',
  'ttf',
  'otf',

  // other
  'webmanifest',
  'pdf',
  'txt',
]

export const KNOWN_ASSET_RE: RegExp = new RegExp(
  `\\.(${KNOWN_ASSET_TYPES.join('|')})$`,
)
export const CSS_LANGS_RE: RegExp
  = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
