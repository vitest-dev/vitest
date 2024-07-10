/* eslint-disable prefer-template */
import { existsSync, readFileSync } from 'node:fs'
import { Writable } from 'node:stream'
import { normalize, relative } from 'pathe'
import c from 'tinyrainbow'
import cliTruncate from 'cli-truncate'
import { inspect } from '@vitest/utils'
import stripAnsi from 'strip-ansi'
import type { ErrorWithDiff, ParsedStack } from '../types'
import {
  lineSplitRE,
  positionToOffset,
} from '../utils/source-map'
import { F_POINTER } from '../utils/figures'
import { TypeCheckError } from '../typecheck/typechecker'
import { isPrimitive } from '../utils'
import type { Vitest } from './core'
import { divider } from './reporters/renderers/utils'
import type { ErrorOptions } from './logger'
import { Logger } from './logger'
import type { WorkspaceProject } from './workspace'

interface PrintErrorOptions {
  type?: string
  logger: Logger
  showCodeFrame?: boolean
  printProperties?: boolean
  screenshotPaths?: string[]
  parseErrorStacktrace: (error: ErrorWithDiff) => ParsedStack[]
}

export interface PrintErrorResult {
  nearest?: ParsedStack
}

// use Logger with custom Console to capture entire error printing
export function capturePrintError(
  error: unknown,
  ctx: Vitest,
  options: ErrorOptions,
) {
  let output = ''
  const writable = new Writable({
    write(chunk, _encoding, callback) {
      output += String(chunk)
      callback()
    },
  })
  const logger = new Logger(ctx, writable, writable)
  const result = logger.printError(error, {
    showCodeFrame: false,
    ...options,
  })
  return { nearest: result?.nearest, output }
}

export function printError(
  error: unknown,
  project: WorkspaceProject | undefined,
  options: PrintErrorOptions,
): PrintErrorResult | undefined {
  const { showCodeFrame = true, type, printProperties = true } = options
  const logger = options.logger
  let e = error as ErrorWithDiff

  if (isPrimitive(e)) {
    e = {
      message: String(error).split(/\n/g)[0],
      stack: String(error),
    } as any
  }

  if (!e) {
    const error = new Error('unknown error')
    e = {
      message: e ?? error.message,
      stack: error.stack,
    } as any
  }

  // Error may have occurred even before the configuration was resolved
  if (!project) {
    printErrorMessage(e, logger)
    return
  }

  const stacks = options.parseErrorStacktrace(e)

  const nearest
    = error instanceof TypeCheckError
      ? error.stacks[0]
      : stacks.find((stack) => {
        try {
          return (
            project.server
            && project.getModuleById(stack.file)
            && existsSync(stack.file)
          )
        }
        catch {
          return false
        }
      })

  if (type) {
    printErrorType(type, project.ctx)
  }
  printErrorMessage(e, logger)
  if (options.screenshotPaths?.length) {
    const length = options.screenshotPaths.length
    logger.error(`\nFailure screenshot${length > 1 ? 's' : ''}:`)
    logger.error(options.screenshotPaths.map(p => `  - ${c.dim(relative(process.cwd(), p))}`).join('\n'))
    if (!e.diff) {
      logger.error()
    }
  }

  if (e.codeFrame) {
    logger.error(`${e.codeFrame}\n`)
  }

  // E.g. AssertionError from assert does not set showDiff but has both actual and expected properties
  if (e.diff) {
    displayDiff(e.diff, logger.console)
  }

  // if the error provide the frame
  if (e.frame) {
    logger.error(c.yellow(e.frame))
  }
  else {
    const errorProperties = printProperties
      ? getErrorProperties(e)
      : {}

    printStack(logger, project, stacks, nearest, errorProperties, (s) => {
      if (showCodeFrame && s === nearest && nearest) {
        const sourceCode = readFileSync(nearest.file, 'utf-8')
        logger.error(
          generateCodeFrame(
            sourceCode.length > 100_000
              ? sourceCode
              : logger.highlight(nearest.file, sourceCode),
            4,
            s,
          ),
        )
      }
    })
  }

  const testPath = (e as any).VITEST_TEST_PATH
  const testName = (e as any).VITEST_TEST_NAME
  const afterEnvTeardown = (e as any).VITEST_AFTER_ENV_TEARDOWN
  // testName has testPath inside
  if (testPath) {
    logger.error(
      c.red(
        `This error originated in "${c.bold(
          testPath,
        )}" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.`,
      ),
    )
  }
  if (testName) {
    logger.error(
      c.red(
        `The latest test that might've caused the error is "${c.bold(
          testName,
        )}". It might mean one of the following:`
        + '\n- The error was thrown, while Vitest was running this test.'
        + '\n- If the error occurred after the test had been completed, this was the last documented test before it was thrown.',
      ),
    )
  }
  if (afterEnvTeardown) {
    logger.error(
      c.red(
        'This error was caught after test environment was torn down. Make sure to cancel any running tasks before test finishes:'
        + '\n- cancel timeouts using clearTimeout and clearInterval'
        + '\n- wait for promises to resolve using the await keyword',
      ),
    )
  }

  if (typeof e.cause === 'object' && e.cause && 'name' in e.cause) {
    (e.cause as any).name = `Caused by: ${(e.cause as any).name}`
    printError(e.cause, project, {
      showCodeFrame: false,
      logger: options.logger,
      parseErrorStacktrace: options.parseErrorStacktrace,
    })
  }

  handleImportOutsideModuleError(e.stack || e.stackStr || '', logger)

  return { nearest }
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
  'ok',
  'operator',
  'diff',
  'codeFrame',
  'actual',
  'expected',
  'diffOptions',
  'VITEST_TEST_NAME',
  'VITEST_TEST_PATH',
  'VITEST_AFTER_ENV_TEARDOWN',
  ...Object.getOwnPropertyNames(Error.prototype),
  ...Object.getOwnPropertyNames(Object.prototype),
])

function getErrorProperties(e: ErrorWithDiff) {
  const errorObject = Object.create(null)
  if (e.name === 'AssertionError') {
    return errorObject
  }

  for (const key of Object.getOwnPropertyNames(e)) {
    if (!skipErrorProperties.has(key)) {
      errorObject[key] = e[key as keyof ErrorWithDiff]
    }
  }

  return errorObject
}

const esmErrors = [
  'Cannot use import statement outside a module',
  'Unexpected token \'export\'',
]

function handleImportOutsideModuleError(stack: string, logger: Logger) {
  if (!esmErrors.some(e => stack.includes(e))) {
    return
  }

  const path = normalize(stack.split('\n')[0].trim())
  let name = path.split('/node_modules/').pop() || ''
  if (name?.startsWith('@')) {
    name = name.split('/').slice(0, 2).join('/')
  }
  else {
    name = name.split('/')[0]
  }

  if (name) {
    printModuleWarningForPackage(logger, path, name)
  }
  else {
    printModuleWarningForSourceCode(logger, path)
  }
}

function printModuleWarningForPackage(
  logger: Logger,
  path: string,
  name: string,
) {
  logger.error(
    c.yellow(
      `Module ${path} seems to be an ES Module but shipped in a CommonJS package. `
      + `You might want to create an issue to the package ${c.bold(
          `"${name}"`,
        )} asking `
        + 'them to ship the file in .mjs extension or add "type": "module" in their package.json.'
        + '\n\n'
        + 'As a temporary workaround you can try to inline the package by updating your config:'
        + '\n\n'
        + c.gray(c.dim('// vitest.config.js'))
        + '\n'
        + c.green(`export default {
  test: {
    server: {
      deps: {
        inline: [
          ${c.yellow(c.bold(`"${name}"`))}
        ]
      }
    }
  }
}\n`),
    ),
  )
}

function printModuleWarningForSourceCode(logger: Logger, path: string) {
  logger.error(
    c.yellow(
      `Module ${path} seems to be an ES Module but shipped in a CommonJS package. `
      + 'To fix this issue, change the file extension to .mjs or add "type": "module" in your package.json.',
    ),
  )
}

export function displayDiff(diff: string | null, console: Console) {
  if (diff) {
    console.error(`\n${diff}\n`)
  }
}

function printErrorMessage(error: ErrorWithDiff, logger: Logger) {
  const errorName = error.name || error.nameStr || 'Unknown Error'
  if (!error.message) {
    logger.error(error)
    return
  }
  if (error.message.length > 5000) {
    // Protect against infinite stack trace in tinyrainbow
    logger.error(`${c.red(c.bold(errorName))}: ${error.message}`)
  }
  else {
    logger.error(c.red(`${c.bold(errorName)}: ${error.message}`))
  }
}

export function printStack(
  logger: Logger,
  project: WorkspaceProject,
  stack: ParsedStack[],
  highlight: ParsedStack | undefined,
  errorProperties: Record<string, unknown>,
  onStack?: (stack: ParsedStack) => void,
) {
  for (const frame of stack) {
    const color = frame === highlight ? c.cyan : c.gray
    const path = relative(project.config.root, frame.file)

    logger.error(
      color(
        ` ${c.dim(F_POINTER)} ${[
          frame.method,
          `${path}:${c.dim(`${frame.line}:${frame.column}`)}`,
        ]
          .filter(Boolean)
          .join(' ')}`,
      ),
    )
    onStack?.(frame)
  }
  if (stack.length) {
    logger.error()
  }
  if (hasProperties(errorProperties)) {
    logger.error(c.red(c.dim(divider())))
    const propertiesString = inspect(errorProperties)
    logger.error(c.red(c.bold('Serialized Error:')), c.gray(propertiesString))
  }
}

function hasProperties(obj: any) {
  // eslint-disable-next-line no-unreachable-loop
  for (const _key in obj) {
    return true
  }
  return false
}

export function generateCodeFrame(
  source: string,
  indent = 0,
  loc: { line: number; column: number } | number,
  range = 2,
): string {
  const start
    = typeof loc === 'object'
      ? positionToOffset(source, loc.line, loc.column)
      : loc
  const end = start
  const lines = source.split(lineSplitRE)
  const nl = /\r\n/.test(source) ? 2 : 1
  let count = 0
  let res: string[] = []

  const columns = process.stdout?.columns || 80

  function lineNo(no: number | string = '') {
    return c.gray(`${String(no).padStart(3, ' ')}| `)
  }

  for (let i = 0; i < lines.length; i++) {
    count += lines[i].length + nl
    if (count >= start) {
      for (let j = i - range; j <= i + range || end > count; j++) {
        if (j < 0 || j >= lines.length) {
          continue
        }

        const lineLength = lines[j].length

        // too long, maybe it's a minified file, skip for codeframe
        if (stripAnsi(lines[j]).length > 200) {
          return ''
        }

        res.push(
          lineNo(j + 1)
          + cliTruncate(lines[j].replace(/\t/g, ' '), columns - 5 - indent),
        )

        if (j === i) {
          // push underline
          const pad = start - (count - lineLength) + (nl - 1)
          const length = Math.max(
            1,
            end > count ? lineLength - pad : end - start,
          )
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

  if (indent) {
    res = res.map(line => ' '.repeat(indent) + line)
  }

  return res.join('\n')
}
