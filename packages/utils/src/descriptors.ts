import * as concordance from 'concordance'
import { getColors } from './colors'

const concordanceModule = 'default' in concordance
  ? concordance.default
  : concordance as any

interface DisplayOptions {
  theme?: any
  maxDepth?: number
}

export function getConcordanceTheme() {
  const c = getColors()

  // this theme is taken from ava: https://github.com/avajs/ava/blob/main/lib/concordance-options.js
  // no adjustments were made so far except for the diff padding
  return {
    boolean: c.yellow,
    circular: c.gray('[Circular]'),
    date: {
      invalid: c.red('invalid'),
      value: c.blue,
    },
    diffGutters: {
      actual: `  ${c.red('-')} `,
      expected: `  ${c.green('+')} `,
      padding: '    ',
    },
    error: {
      ctor: { open: `${c.gray.open}(`, close: `)${c.gray.close}` },
      name: c.magenta,
    },
    function: {
      name: c.blue,
      stringTag: c.magenta,
    },
    global: c.magenta,
    item: { after: c.gray(',') },
    list: { openBracket: c.gray('['), closeBracket: c.gray(']') },
    mapEntry: { after: c.gray(',') },
    maxDepth: c.gray('…'),
    null: c.yellow,
    number: c.yellow,
    object: {
      openBracket: c.gray('{'),
      closeBracket: c.gray('}'),
      ctor: c.magenta,
      stringTag: { open: `${c.magenta.open}@`, close: c.magenta.close },
      secondaryStringTag: { open: `${c.gray.open}@`, close: c.gray.close },
    },
    property: {
      after: c.gray(','),
      keyBracket: { open: c.gray('['), close: c.gray(']') },
      valueFallback: c.gray('…'),
    },
    regexp: {
      source: { open: `${c.blue.open}/`, close: `/${c.blue.close}` },
      flags: c.yellow,
    },
    stats: { separator: c.gray('---') },
    string: {
      open: c.blue.open,
      close: c.blue.close,
      line: { open: c.blue('\''), close: c.blue('\'') },
      multiline: { start: c.blue('`'), end: c.blue('`') },
      controlPicture: c.gray,
      diff: {
        insert: {
          open: c.bgGreen.open + c.black.open,
          close: c.black.close + c.bgGreen.close,
        },
        delete: {
          open: c.bgRed.open + c.black.open,
          close: c.black.close + c.bgRed.close,
        },
        equal: c.blue,
        insertLine: {
          open: c.green.open,
          close: c.green.close,
        },
        deleteLine: {
          open: c.red.open,
          close: c.red.close,
        },
      },
    },
    symbol: c.yellow,
    typedArray: {
      bytes: c.yellow,
    },
    undefined: c.yellow,
  }
}

export function diffDescriptors(actual: unknown, expected: unknown, options: DisplayOptions): string {
  return concordanceModule.diff(actual, expected, options)
}
