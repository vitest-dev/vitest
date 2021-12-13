/* eslint-disable no-console */
import { promises as fs, existsSync } from 'fs'
import c from 'picocolors'
import * as diff from 'diff'
import type { RawSourceMap } from 'source-map'
import { SourceMapConsumer } from 'source-map'
import cliTruncate from 'cli-truncate'
import type { ViteDevServer } from 'vite'
import { notNullish } from '../utils'
import type { VitestContext } from '../types'
import { F_POINTER } from './figures'

interface ErrorWithDiff extends Error {
  name: string
  nameStr?: string
  stack?: string
  stackStr?: string
  showDiff?: boolean
  actual?: any
  expected?: any
  operator?: string
}

interface Position {
  line: number
  column: number
}

declare global {
  namespace NodeJS {
    interface Process {
      __vitest__: VitestContext
    }
  }
}

export async function printError(error: unknown) {
  const { server } = process.__vitest__

  let e = error as ErrorWithDiff

  if (typeof error === 'string') {
    e = {
      message: error.split(/\n/g)[0],
      stack: error,
    } as any
  }

  let codeFramePrinted = false
  const stackStr = e.stack || e.stackStr || ''
  const stacks = parseStack(stackStr)
  const nearest = stacks.find(stack => !stack.file.includes('vitest/dist') && server.moduleGraph.getModuleById(stack.file))
  if (nearest) {
    const pos = await getSourcePos(server, nearest)
    if (pos && existsSync(nearest.file)) {
      const sourceCode = await fs.readFile(nearest.file, 'utf-8')
      printErrorMessage(e)

      await printStack(server, stacks, nearest, (s) => {
        if (s === nearest)
          console.log(c.yellow(generateCodeFrame(sourceCode, 4, pos)))
      })

      codeFramePrinted = true
    }
  }

  if (!codeFramePrinted)
    console.error(e)

  if (e.showDiff)
    displayDiff(e.actual, e.expected)
}

async function getSourcePos(server: ViteDevServer, nearest: ParsedStack) {
  const mod = server.moduleGraph.getModuleById(nearest.file)
  const transformResult = mod?.ssrTransformResult
  const pos = await getOriginalPos(transformResult?.map, nearest)
  return pos
}

// TODO: handle big object and big string diff
function displayDiff(actual: string, expected: string) {
  console.error(c.gray(generateDiff(stringify(actual), stringify(expected))))
}

function printErrorMessage(error: ErrorWithDiff) {
  const errorName = error.name || error.nameStr || 'Unknown Error'

  console.error(c.red(`${c.bold(errorName)}: ${error.message}`))
}

async function printStack(server: ViteDevServer,
  stack: ParsedStack[],
  highlight?: ParsedStack,
  onStack?: ((stack: ParsedStack) => void),
) {
  if (!stack.length)
    return

  for (const frame of stack) {
    const pos = await getSourcePos(server, frame) || frame
    const color = frame === highlight ? c.yellow : c.gray
    console.log(color(` ${c.dim(F_POINTER)} ${[frame.method, c.dim(`${frame.file}:${pos.line}:${pos.column}`)].filter(Boolean).join(' ')}`))
    onStack?.(frame)
  }
  console.log()
}

function getOriginalPos(map: RawSourceMap | null | undefined, { line, column }: Position): Promise<Position | null> {
  return new Promise((resolve) => {
    if (!map)
      return resolve(null)

    SourceMapConsumer.with(map, null, (consumer) => {
      const pos = consumer.originalPositionFor({ line, column })
      if (pos.line != null && pos.column != null)
        resolve(pos as Position)
      else
        resolve(null)
    })
  })
}

const splitRE = /\r?\n/

export function posToNumber(
  source: string,
  pos: number | Position,
): number {
  if (typeof pos === 'number') return pos
  const lines = source.split(splitRE)
  const { line, column } = pos
  let start = 0
  for (let i = 0; i < line - 1; i++)
    start += lines[i].length + 1

  return start + column
}

export function numberToPos(
  source: string,
  offset: number | Position,
): Position {
  if (typeof offset !== 'number') return offset
  if (offset > source.length) {
    throw new Error(
      `offset is longer than source length! offset ${offset} > length ${source.length}`,
    )
  }
  const lines = source.split(splitRE)
  let counted = 0
  let line = 0
  let column = 0
  for (; line < lines.length; line++) {
    const lineLength = lines[line].length + 1
    if (counted + lineLength >= offset) {
      column = offset - counted + 1
      break
    }
    counted += lineLength
  }
  return { line: line + 1, column }
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
  const lines = source.split(splitRE)
  let count = 0
  let res: string[] = []

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

        res.push(lineNo(j + 1) + cliTruncate(lines[j], process.stdout.columns - 5 - indent))

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

function stringify(obj: any) {
  // TODO: handle more types
  return String(obj)
}

const stackFnCallRE = /at (.*) \((.+):(\d+):(\d+)\)$/
const stackBarePathRE = /at ?(.*) (.+):(\d+):(\d+)$/

interface ParsedStack {
  method: string
  file: string
  line: number
  column: number
}

function parseStack(stack: string): ParsedStack[] {
  const lines = stack.split('\n')
  const stackFrames = lines.map((raw) => {
    const line = raw.trim()
    const match = line.match(stackFnCallRE) || line.match(stackBarePathRE)
    if (!match)
      return null

    let file = match[2]
    if (file.startsWith('file://'))
      file = file.slice(7)

    return {
      method: match[1],
      file: match[2],
      line: parseInt(match[3]),
      column: parseInt(match[4]),
    }
  })
  return stackFrames.filter(notNullish)
}

/**
 * Returns a diff between 2 strings with coloured ANSI output.
 *
 * @description
 * The diff will be either inline or unified dependent on the value
 * of `Base.inlineDiff`.
 *
 * @param {string} actual
 * @param {string} expected
 * @return {string} Diff
 */
export function generateDiff(actual: any, expected: any) {
  const diffSize = 2048
  if (actual.length > diffSize)
    actual = `${actual.substring(0, diffSize)} ... Lines skipped`

  if (expected.length > diffSize)
    expected = `${expected.substring(0, diffSize)} ... Lines skipped`

  return unifiedDiff(actual, expected)
}

/**
 * Returns unified diff between two strings with coloured ANSI output.
 *
 * @private
 * @param {String} actual
 * @param {String} expected
 * @return {string} The diff.
 */
function unifiedDiff(actual: any, expected: any) {
  const indent = '  '
  function cleanUp(line: string) {
    if (line[0] === '+')
      return indent + c.green(`${line[0]}${line.slice(1)}`)
    if (line[0] === '-')
      return indent + c.red(`${line[0]}${line.slice(1)}`)
    if (line.match(/@@/))
      return '--'
    if (line.match(/\\ No newline/))
      return null
    return indent + line
  }
  const msg = diff.createPatch('string', actual, expected)
  const lines = msg.split('\n').splice(5)
  return (
    `\n${indent}${c.red('- actual')}\n${indent}${c.green('+ expected')}\n\n${
      lines.map(cleanUp).filter(notBlank).join('\n')}`
  )
}

function notBlank(line: any) {
  return typeof line !== 'undefined' && line !== null
}
