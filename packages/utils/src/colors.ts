import type p from 'picocolors'
import type { Formatter } from 'picocolors/types'
import { SAFE_COLORS_SYMBOL } from './constants'

const colors = [
  'reset',
  'bold',
  'dim',
  'italic',
  'underline',
  'inverse',
  'hidden',
  'strikethrough',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
  'bgBlack',
  'bgRed',
  'bgGreen',
  'bgYellow',
  'bgBlue',
  'bgMagenta',
  'bgCyan',
  'bgWhite',
] as const

const formatter: Formatter = str => String(str)

const defaultColors = colors.reduce((acc, key) => {
  acc[key] = formatter
  return acc
}, { isColorSupported: false } as typeof p)

export function getColors(): typeof p {
  return (globalThis as any)[SAFE_COLORS_SYMBOL] || defaultColors
}

export function setColors(colors: typeof p) {
  (globalThis as any)[SAFE_COLORS_SYMBOL] = colors
}
