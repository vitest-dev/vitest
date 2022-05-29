/* eslint-disable prefer-template */
import { existsSync, readFileSync } from 'fs'
import { join, normalize, relative } from 'pathe'
import c from 'picocolors'
import cliTruncate from 'cli-truncate'
import type { ErrorWithDiff, ParsedStack, Position } from '../types'
import { interpretSourcePos, lineSplitRE, parseStacktrace, posToNumber } from '../utils/source-map'
import { F_POINTER } from '../utils/figures'
import { stringify } from '../integrations/chai/jest-matcher-utils'
import type { Vitest } from './core'
import { unifiedDiff } from './diff'
import { divider } from './reporters/renderers/utils'

export function fileFromParsedStack(stack: ParsedStack) {
  if (stack?.sourcePos?.source?.startsWith('..'))
    return join(stack.file, '../', stack.sourcePos.source)
  return stack.file
}

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

  const stacks = parseStacktrace(e, fullStack)

  await interpretSourcePos(stacks, ctx)

  const nearest = stacks.find(stack =>
    ctx.server.moduleGraph.getModuleById(stack.file)
      && existsSync(stack.file),
  )

  const errorProperties = getErrorProperties(e)

  if (type)
    printErrorType(type, ctx)
  printErrorMessage(e, ctx.console)
  printStack(ctx, stacks, nearest, errorProperties, (s, pos) => {
    if (showCodeFrame && s === nearest && nearest) {
      const sourceCode = readFileSync(fileFromParsedStack(nearest), 'utf-8')
      ctx.log(c.yellow(generateCodeFrame(sourceCode, 4, pos)))
    }
  })

  if (e.cause) {
    e.cause.name = `Caused by: ${e.cause.name}`
    await printError(e.cause, ctx, { fullStack, showCodeFrame: false })
  }

  handleImportOutsideModuleError(e.stack || e.stackStr || '', ctx)

  if (e.showDiff)
    displayDiff(stringify(e.actual), stringify(e.expected), ctx.console, ctx.config.outputTruncateLength)
}

function printErrorType(type: string, ctx: Vitest) {
  ctx.error(`\n${c.red(divider(c.bold(c.inverse(` ${type} `))))}`)
}

const skipErrorProperties = [
  'message',
  'name',
  'nameStr',
  'stack',
  'cause',
  'stacks',
  'stackStr',
  'type',
  'showDiff',
  'actual',
  'expected',
  'constructor',
  'toString',
]

function getErrorProperties(e: ErrorWithDiff) {
  const errorObject = Object.create(null)
  if (e.name === 'AssertionError')
    return errorObject

  for (const key of Object.getOwnPropertyNames(e)) {
    if (!skipErrorProperties.includes(key))
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

  ctx.error(c.yellow(
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

function displayDiff(actual: string, expected: string, console: Console, outputTruncateLength?: number) {
  console.error(c.gray(unifiedDiff(actual, expected, { outputTruncateLength })) + '\n')
}

function printErrorMessage(error: ErrorWithDiff, console: Console) {
  const errorName = error.name || error.nameStr || 'Unknown Error'
  console.error(c.red(`${c.bold(errorName)}: ${error.message}`))
}

function printStack(
  ctx: Vitest,
  stack: ParsedStack[],
  highlight: ParsedStack | undefined,
  errorProperties: Record<string, unknown>,
  onStack?: ((stack: ParsedStack, pos: Position) => void),
) {
  if (!stack.length)
    return

  for (const frame of stack) {
    const pos = frame.sourcePos || frame
    const color = frame === highlight ? c.yellow : c.gray
    const file = fileFromParsedStack(frame)
    const path = relative(ctx.config.root, file)

    ctx.log(color(` ${c.dim(F_POINTER)} ${[frame.method, c.dim(`${path}:${pos.line}:${pos.column}`)].filter(Boolean).join(' ')}`))
    onStack?.(frame, pos)

    // reached at test file, skip the follow stack
    if (frame.file in ctx.state.filesMap)
      break
  }
  ctx.log()
  const hasProperties = Object.keys(errorProperties).length > 0
  if (hasProperties) {
    ctx.log(c.red(c.dim(divider())))
    const propertiesString = stringify(errorProperties, 10, { printBasicPrototype: false })
    ctx.log(c.red(c.bold('Serialized Error:')), c.gray(propertiesString))
  }
}

export function generateCodeFrame(
  source: string,
  indent = 0,
  start: number | Position = 0,
  end?: number,
  range = 2,
): string {
  start = posToNumber(source, start)
  end = end || start
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

        res.push(lineNo(j + 1) + cliTruncate(lines[j], columns - 5 - indent))

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
