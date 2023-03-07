import { SAFE_COLORS_SYMBOL } from './constants'

type Colors = ReturnType<typeof createColors>

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

const string = (str: unknown) => String(str)
string.open = ''
string.close = ''

const defaultColors = colors.reduce((acc, key) => {
  acc[key] = string
  return acc
}, {} as Colors)

export function getDefaultColors(): Colors {
  return { ...defaultColors }
}

export function getColors(): Colors {
  return (globalThis as any)[SAFE_COLORS_SYMBOL] || defaultColors
}

export function createColors(isTTY = false) {
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
      const string = `${input}`
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
  return {
    isColorSupported: enabled,
    reset: enabled ? (s: string) => `\x1B[0m${s}\x1B[0m` : string,
    bold: enabled ? formatter('\x1B[1m', '\x1B[22m', '\x1B[22m\x1B[1m') : string,
    dim: enabled ? formatter('\x1B[2m', '\x1B[22m', '\x1B[22m\x1B[2m') : string,
    italic: enabled ? formatter('\x1B[3m', '\x1B[23m') : string,
    underline: enabled ? formatter('\x1B[4m', '\x1B[24m') : string,
    inverse: enabled ? formatter('\x1B[7m', '\x1B[27m') : string,
    hidden: enabled ? formatter('\x1B[8m', '\x1B[28m') : string,
    strikethrough: enabled ? formatter('\x1B[9m', '\x1B[29m') : string,
    black: enabled ? formatter('\x1B[30m', '\x1B[39m') : string,
    red: enabled ? formatter('\x1B[31m', '\x1B[39m') : string,
    green: enabled ? formatter('\x1B[32m', '\x1B[39m') : string,
    yellow: enabled ? formatter('\x1B[33m', '\x1B[39m') : string,
    blue: enabled ? formatter('\x1B[34m', '\x1B[39m') : string,
    magenta: enabled ? formatter('\x1B[35m', '\x1B[39m') : string,
    cyan: enabled ? formatter('\x1B[36m', '\x1B[39m') : string,
    white: enabled ? formatter('\x1B[37m', '\x1B[39m') : string,
    gray: enabled ? formatter('\x1B[90m', '\x1B[39m') : string,
    bgBlack: enabled ? formatter('\x1B[40m', '\x1B[49m') : string,
    bgRed: enabled ? formatter('\x1B[41m', '\x1B[49m') : string,
    bgGreen: enabled ? formatter('\x1B[42m', '\x1B[49m') : string,
    bgYellow: enabled ? formatter('\x1B[43m', '\x1B[49m') : string,
    bgBlue: enabled ? formatter('\x1B[44m', '\x1B[49m') : string,
    bgMagenta: enabled ? formatter('\x1B[45m', '\x1B[49m') : string,
    bgCyan: enabled ? formatter('\x1B[46m', '\x1B[49m') : string,
    bgWhite: enabled ? formatter('\x1B[47m', '\x1B[49m') : string,
  }
}

export function setupColors(colors: Colors) {
  (globalThis as any)[SAFE_COLORS_SYMBOL] = colors
}
