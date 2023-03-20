import { SAFE_COLORS_SYMBOL } from './constants'

const colorsMap = {
  bold: ['\x1B[1m', '\x1B[22m', '\x1B[22m\x1B[1m'],
  dim: ['\x1B[2m', '\x1B[22m', '\x1B[22m\x1B[2m'],
  italic: ['\x1B[3m', '\x1B[23m'],
  underline: ['\x1B[4m', '\x1B[24m'],
  inverse: ['\x1B[7m', '\x1B[27m'],
  hidden: ['\x1B[8m', '\x1B[28m'],
  strikethrough: ['\x1B[9m', '\x1B[29m'],
  black: ['\x1B[30m', '\x1B[39m'],
  red: ['\x1B[31m', '\x1B[39m'],
  green: ['\x1B[32m', '\x1B[39m'],
  yellow: ['\x1B[33m', '\x1B[39m'],
  blue: ['\x1B[34m', '\x1B[39m'],
  magenta: ['\x1B[35m', '\x1B[39m'],
  cyan: ['\x1B[36m', '\x1B[39m'],
  white: ['\x1B[37m', '\x1B[39m'],
  gray: ['\x1B[90m', '\x1B[39m'],
  bgBlack: ['\x1B[40m', '\x1B[49m'],
  bgRed: ['\x1B[41m', '\x1B[49m'],
  bgGreen: ['\x1B[42m', '\x1B[49m'],
  bgYellow: ['\x1B[43m', '\x1B[49m'],
  bgBlue: ['\x1B[44m', '\x1B[49m'],
  bgMagenta: ['\x1B[45m', '\x1B[49m'],
  bgCyan: ['\x1B[46m', '\x1B[49m'],
  bgWhite: ['\x1B[47m', '\x1B[49m'],
} as const

type ColorName = keyof typeof colorsMap
type ColorsMethods = {
  [Key in ColorName]: (input: unknown) => string
}

type Colors = ColorsMethods & {
  isColorSupported: boolean
  reset: (input: unknown) => string
}

const colorsEntries = Object.entries(colorsMap)

const string = (str: unknown) => String(str)
string.open = ''
string.close = ''

const defaultColors = colorsEntries.reduce((acc, [key]) => {
  acc[key as ColorName] = string
  return acc
}, { isColorSupported: false } as Colors)

export function getDefaultColors(): Colors {
  return { ...defaultColors }
}

export function getColors(): Colors {
  return (globalThis as any)[SAFE_COLORS_SYMBOL] || defaultColors
}

export function createColors(isTTY = false): Colors {
  const enabled = typeof process !== 'undefined'
    && !('NO_COLOR' in process.env || process.argv.includes('--no-color'))
    && !('GITHUB_ACTIONS' in process.env)
    && ('FORCE_COLOR' in process.env
    || process.argv.includes('--color')
    || process.platform === 'win32'
    || (isTTY && process.env.TERM !== 'dumb')
    || 'CI' in process.env)

  const replaceClose = (string: string, close: string, replace: string, index: number): string => {
    const start = string.substring(0, index) + replace
    const end = string.substring(index + close.length)
    const nextIndex = end.indexOf(close)
    return ~nextIndex ? start + replaceClose(end, close, replace, nextIndex) : start + end
  }

  const formatter = (open: string, close: string, replace = open) => {
    const fn = (input: unknown) => {
      const string = String(input)
      const index = string.indexOf(close, open.length)
      return ~index
        ? open + replaceClose(string, close, replace, index) + close
        : open + string + close
    }
    fn.open = open
    fn.close = close
    return fn
  }

  // based on "https://github.com/alexeyraspopov/picocolors", but browser-friendly
  const colorsObject = {
    isColorSupported: enabled,
    reset: enabled ? (s: string) => `\x1B[0m${s}\x1B[0m` : string,
  } as Colors

  for (const [name, formatterArgs] of colorsEntries) {
    colorsObject[name as ColorName] = enabled
      ? formatter(...formatterArgs as [string, string])
      : string
  }

  return colorsObject
}

export function setupColors(colors: Colors) {
  (globalThis as any)[SAFE_COLORS_SYMBOL] = colors
}
