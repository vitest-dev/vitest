/* eslint-disable prefer-template */
import { existsSync, readFileSync } from 'fs'
import { normalize, relative } from 'pathe'
import c from 'picocolors'
import cliTruncate from 'cli-truncate'
import { stringify } from '@vitest/utils'
import type { ErrorWithDiff, ParsedStack } from '../types'
import { lineSplitRE, parseStacktrace, positionToOffset } from '../utils/source-map'
import { F_POINTER } from '../utils/figures'
import { TypeCheckError } from '../typecheck/typechecker'
import { type DiffOptions, unifiedDiff } from '../utils/diff'
import type { Vitest } from './core'
import { divider } from './reporters/renderers/utils'
import type { Logger } from './logger'

interface PrintErrorOptions {
  type?: string
  fullStack?: boolean
  showCodeFrame?: boolean
}

export async function printError(error: unknown, ctx: Vitest, options: PrintErrorOptions = {}) {
  const { showCodeFrame = true, fullStack = false, type } = options
  let e = error as ErrorWithDiff

  if (typeof error === 'string') {
    e = {
      message: error.split(/\n/g)[0],
      stack: error,
    } as any
  }

  if (!e) {
    const error = new Error('unknown error')
    e = {
      message: e ?? error.message,
      stack: error.stack,
    } as any
  }

  const stacks = parseStacktrace(e, fullStack)

  const nearest = error instanceof TypeCheckError
    ? error.stacks[0]
    : stacks.find(stack =>
      ctx.server.moduleGraph.getModuleById(stack.file)
      && existsSync(stack.file),
    )

  const errorProperties = getErrorProperties(e)

  if (type)
    printErrorType(type, ctx)
  printErrorMessage(e, ctx.logger)

  // if the error provide the frame
  if (e.frame) {
    ctx.logger.error(c.yellow(e.frame))
  }
  else {
    printStack(ctx, stacks, nearest, errorProperties, (s) => {
      if (showCodeFrame && s === nearest && nearest) {
        const sourceCode = readFileSync(nearest.file, 'utf-8')
        ctx.logger.error(c.yellow(generateCodeFrame(sourceCode, 4, s.line, s.column)))
      }
    })
  }

  const testPath = (e as any).VITEST_TEST_PATH
  const testName = (e as any).VITEST_TEST_NAME
  // testName has testPath inside
  if (testPath && !testName)
    ctx.logger.error(c.red(`This error originated in "${c.bold(testPath)}" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.`))
  if (testName) {
    ctx.logger.error(c.red(`The latest test that might've cause the error is "${c.bold(testName)}". It might mean one of the following:`
    + '\n- The error was thrown, while Vitest was running this test.'
    + '\n- This was the last recorder test before the error was thrown, if error originated after test finished its execution.'))
  }

  if (typeof e.cause === 'object' && e.cause && 'name' in e.cause) {
    (e.cause as any).name = `Caused by: ${(e.cause as any).name}`
    await printError(e.cause, ctx, { fullStack, showCodeFrame: false })
  }

  handleImportOutsideModuleError(e.stack || e.stackStr || '', ctx)

  // E.g. AssertionError from assert does not set showDiff but has both actual and expected properties
  if (e.showDiff || (e.showDiff === undefined && e.actual && e.expected)) {
    displayDiff(stringify(e.actual), stringify(e.expected), ctx.logger.console, {
      outputTruncateLength: ctx.config.outputTruncateLength,
      outputDiffLines: ctx.config.outputDiffLines,
      outputDiffMaxLines: ctx.config.outputDiffMaxLines,
    })
  }
}

function printErrorType(type: string, ctx: Vitest) {
  ctx.logger.error(`\n${c.red(divider(c.bold(c.inverse(` ${type} `))))}`)
}

const skipErrorProperties = new Set([
  'nameStr',
  'stack',
  'cause',
  'stacks',
  'stackStr',
  'type',
  'showDiff',
  'actual',
  'expected',
  'VITEST_TEST_NAME',
  'VITEST_TEST_PATH',
  ...Object.getOwnPropertyNames(Error.prototype),
  ...Object.getOwnPropertyNames(Object.prototype),
])

function getErrorProperties(e: ErrorWithDiff) {
  const errorObject = Object.create(null)
  if (e.name === 'AssertionError')
    return errorObject

  for (const key of Object.getOwnPropertyNames(e)) {
    if (!skipErrorProperties.has(key))
      errorObject[key] = e[key as keyof ErrorWithDiff]
  }

  return errorObject
}

const esmErrors = [
  'Cannot use import statement outside a module',
  'Unexpected token \'export\'',
]

function handleImportOutsideModuleError(stack: string, ctx: Vitest) {
  if (!esmErrors.some(e => stack.includes(e)))
    return

  const path = normalize(stack.split('\n')[0].trim())
  let name = path.split('/node_modules/').pop() || ''
  if (name?.startsWith('@'))
    name = name.split('/').slice(0, 2).join('/')
  else
    name = name.split('/')[0]

  ctx.logger.error(c.yellow(
    `Module ${path} seems to be an ES Module but shipped in a CommonJS package. `
+ `You might want to create an issue to the package ${c.bold(`"${name}"`)} asking `
+ 'them to ship the file in .mjs extension or add "type": "module" in their package.json.'
+ '\n\n'
+ 'As a temporary workaround you can try to inline the package by updating your config:'
+ '\n\n'
+ c.gray(c.dim('// vitest.config.js'))
+ '\n'
+ c.green(`export default {
  test: {
    deps: {
      inline: [
        ${c.yellow(c.bold(`"${name}"`))}
      ]
    }
  }
}\n`)))
}

export function displayDiff(actual: string, expected: string, console: Console, options: Omit<DiffOptions, 'showLegend'> = {}) {
  const diff = unifiedDiff(actual, expected, options)
  const dim = options.noColor ? (s: string) => s : c.dim
  const black = options.noColor ? (s: string) => s : c.black
  if (diff)
    console.error(diff + '\n')
  else if (actual && expected && actual !== '"undefined"' && expected !== '"undefined"')
    console.error(dim('Could not display diff. It\'s possible objects are too large to compare.\nTry increasing ') + black('--outputDiffMaxSize') + dim(' option.\n'))
}

function printErrorMessage(error: ErrorWithDiff, logger: Logger) {
  const errorName = error.name || error.nameStr || 'Unknown Error'
  logger.error(c.red(`${c.bold(errorName)}: ${error.message}`))
}

function printStack(
  ctx: Vitest,
  stack: ParsedStack[],
  highlight: ParsedStack | undefined,
  errorProperties: Record<string, unknown>,
  onStack?: ((stack: ParsedStack) => void),
) {
  if (!stack.length)
    return

  const logger = ctx.logger

  for (const frame of stack) {
    const color = frame === highlight ? c.yellow : c.gray
    const path = relative(ctx.config.root, frame.file)

    logger.error(color(` ${c.dim(F_POINTER)} ${[frame.method, c.dim(`${path}:${frame.line}:${frame.column}`)].filter(Boolean).join(' ')}`))
    onStack?.(frame)
  }
  logger.error()
  const hasProperties = Object.keys(errorProperties).length > 0
  if (hasProperties) {
    logger.error(c.red(c.dim(divider())))
    const propertiesString = stringify(errorProperties, 10, { printBasicPrototype: false })
    logger.error(c.red(c.bold('Serialized Error:')), c.gray(propertiesString))
  }
}

export function generateCodeFrame(
  source: string,
  indent = 0,
  lineNumber: number,
  columnNumber: number,
  range = 2,
): string {
  const start = positionToOffset(source, lineNumber, columnNumber)
  const end = start
  const lines = source.split(lineSplitRE)
  let count = 0
  let res: string[] = []

  const columns = process.stdout?.columns || 80

  function lineNo(no: number | string = '') {
    return c.gray(`${String(no).padStart(3, ' ')}| `)
  }

  for (let i = 0; i < lines.length; i++) {
    count += lines[i].length + 1
    if (count >= start) {
      for (let j = i - range; j <= i + range || end > count; j++) {
        if (j < 0 || j >= lines.length)
          continue

        const lineLength = lines[j].length

        // to long, maybe it's a minified file, skip for codeframe
        if (lineLength > 200)
          return ''

        res.push(lineNo(j + 1) + cliTruncate(lines[j].replace(/\t/g, ' '), columns - 5 - indent))

        if (j === i) {
          // push underline
          const pad = start - (count - lineLength)
          const length = Math.max(1, end > count ? lineLength - pad : end - start)
          res.push(lineNo() + ' '.repeat(pad) + c.red('^'.repeat(length)))
        }
        else if (j > i) {
          if (end > count) {
            const length = Math.max(1, Math.min(end - count, lineLength))
            res.push(lineNo() + c.red('^'.repeat(length)))
          }
          count += lineLength + 1
        }
      }
      break
    }
  }

  if (indent)
    res = res.map(line => ' '.repeat(indent) + line)

  return res.join('\n')
}
