/* eslint-disable prefer-template */
/* eslint-disable no-template-curly-in-string */
import { existsSync, promises as fs } from 'fs'
import { relative } from 'pathe'
import c from 'picocolors'
import cliTruncate from 'cli-truncate'
import type { ErrorWithDiff, ParsedStack, Position } from '../types'
import { interpretSourcePos, lineSplitRE, parseStacktrace, posToNumber } from '../utils/source-map'
import { F_POINTER } from '../utils/figures'
import type { Vitest } from './core'
import { unifiedDiff } from './diff'

export async function printError(error: unknown, ctx: Vitest) {
  let e = error as ErrorWithDiff

  if (typeof error === 'string') {
    e = {
      message: error.split(/\n/g)[0],
      stack: error,
    } as any
  }

  const stacks = parseStacktrace(e)

  await interpretSourcePos(stacks, ctx)

  const nearest = stacks.find(stack =>
    ctx.server.moduleGraph.getModuleById(stack.file)
      && existsSync(stack.file),
  )

  printErrorMessage(e, ctx.console)
  await printStack(ctx, stacks, nearest, async(s, pos) => {
    if (s === nearest && nearest) {
      const sourceCode = await fs.readFile(nearest.file, 'utf-8')
      ctx.log(c.yellow(generateCodeFrame(sourceCode, 4, pos)))
    }
  })

  handleImportOutsideModuleError(e.stack || e.stackStr || '', ctx)

  if (e.showDiff)
    displayDiff(e.actual, e.expected, ctx.console)
}

const esmErrors = [
  'Cannot use import statement outside a module',
  'Unexpected token \'export\'',
]

function handleImportOutsideModuleError(stack: string, ctx: Vitest) {
  if (!esmErrors.some(e => stack.includes(e)))
    return

  const path = stack.split('\n')[0].trim()
  let name = path.split('/node_modules/').pop() || ''
  if (name?.startsWith('@'))
    name = name.split('/').slice(0, 2).join('/')
  else
    name = name.split('/')[0]

  ctx.console.error(c.yellow(
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

function displayDiff(actual: string, expected: string, console: Console) {
  console.error(c.gray(unifiedDiff(actual, expected)) + '\n')
}

function printErrorMessage(error: ErrorWithDiff, console: Console) {
  const errorName = error.name || error.nameStr || 'Unknown Error'
  console.error(c.red(`${c.bold(errorName)}: ${error.message}`))
}

async function printStack(
  ctx: Vitest,
  stack: ParsedStack[],
  highlight?: ParsedStack,
  onStack?: ((stack: ParsedStack, pos: Position) => void),
) {
  if (!stack.length)
    return

  for (const frame of stack) {
    const pos = frame.sourcePos || frame
    const color = frame === highlight ? c.yellow : c.gray
    const path = relative(ctx.config.root, frame.file)

    ctx.log(color(` ${c.dim(F_POINTER)} ${[frame.method, c.dim(`${path}:${pos.line}:${pos.column}`)].filter(Boolean).join(' ')}`))
    await onStack?.(frame, pos)

    // reached at test file, skip the follow stack
    if (frame.file in ctx.state.filesMap)
      break
  }
  ctx.log()
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

  const columns = process.stdout.columns || 80

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
