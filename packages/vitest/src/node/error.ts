/* eslint-disable prefer-template */
import type { ErrorWithDiff, ParsedStack } from '@vitest/utils'
import type { Vitest } from './core'
import type { ErrorOptions, Logger } from './logger'
import type { TestProject } from './project'
import { Console } from 'node:console'
import { existsSync, readFileSync } from 'node:fs'
import { Writable } from 'node:stream'
import { stripVTControlCharacters } from 'node:util'
import { inspect, isPrimitive } from '@vitest/utils'
import { normalize, relative } from 'pathe'
import c from 'tinyrainbow'
import { TypeCheckError } from '../typecheck/typechecker'
import {
  lineSplitRE,
  parseErrorStacktrace,
  positionToOffset,
} from '../utils/source-map'
import { F_POINTER } from './reporters/renderers/figures'
import { divider, truncateString } from './reporters/renderers/utils'

type ErrorLogger = Pick<Logger, 'error' | 'highlight'>

interface PrintErrorOptions {
  logger: ErrorLogger
  type?: string
  showCodeFrame?: boolean
  printProperties?: boolean
  screenshotPaths?: string[]
  parseErrorStacktrace: (error: ErrorWithDiff) => ParsedStack[]
}

interface PrintErrorResult {
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
  const console = new Console(writable)
  const logger: ErrorLogger = {
    error: console.error.bind(console),
    highlight: ctx.logger.highlight.bind(ctx.logger),
  }
  const result = printError(error, ctx, logger, {
    showCodeFrame: false,
    ...options,
  })
  return { nearest: result?.nearest, output }
}

export function printError(
  error: unknown,
  ctx: Vitest,
  logger: ErrorLogger,
  options: ErrorOptions,
) {
  const project = options.project
    ?? ctx.coreWorkspaceProject
    ?? ctx.projects[0]
  return printErrorInner(error, project, {
    logger,
    type: options.type,
    showCodeFrame: options.showCodeFrame,
    screenshotPaths: options.screenshotPaths,
    printProperties: options.verbose,
    parseErrorStacktrace(error) {
      // browser stack trace needs to be processed differently,
      // so there is a separate method for that
      if (options.task?.file.pool === 'browser' && project.browser) {
        return project.browser.parseErrorStacktrace(error, {
          ignoreStackEntries: options.fullStack ? [] : undefined,
        })
      }

      // node.js stack trace already has correct source map locations
      return parseErrorStacktrace(error, {
        frameFilter: project.config.onStackTrace,
        ignoreStackEntries: options.fullStack ? [] : undefined,
      })
    },
  })
}

function printErrorInner(
  error: unknown,
  project: TestProject | undefined,
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

  if ('__vitest_rollup_error__' in e) {
    // https://github.com/vitejs/vite/blob/95020ab49e12d143262859e095025cf02423c1d9/packages/vite/src/node/server/middlewares/error.ts#L25-L36
    const err = e.__vitest_rollup_error__ as any
    logger.error([
      err.plugin && `  Plugin: ${c.magenta(err.plugin)}`,
      err.id && `  File: ${c.cyan(err.id)}${err.loc ? `:${err.loc.line}:${err.loc.column}` : ''}`,
      err.frame && c.yellow((err.frame as string).split(/\r?\n/g).map(l => ` `.repeat(2) + l).join(`\n`)),
    ].filter(Boolean).join('\n'))
  }

  // E.g. AssertionError from assert does not set showDiff but has both actual and expected properties
  if (e.diff) {
    logger.error(`\n${e.diff}\n`)
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
    printErrorInner(e.cause, project, {
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

function handleImportOutsideModuleError(stack: string, logger: ErrorLogger) {
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
  logger: ErrorLogger,
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

function printModuleWarningForSourceCode(logger: ErrorLogger, path: string) {
  logger.error(
    c.yellow(
      `Module ${path} seems to be an ES Module but shipped in a CommonJS package. `
      + 'To fix this issue, change the file extension to .mjs or add "type": "module" in your package.json.',
    ),
  )
}

function printErrorMessage(error: ErrorWithDiff, logger: ErrorLogger) {
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

function printStack(
  logger: ErrorLogger,
  project: TestProject,
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

  for (let i = 0; i < lines.length; i++) {
    count += lines[i].length + nl
    if (count >= start) {
      for (let j = i - range; j <= i + range || end > count; j++) {
        if (j < 0 || j >= lines.length) {
          continue
        }

        const lineLength = lines[j].length

        // too long, maybe it's a minified file, skip for codeframe
        if (stripVTControlCharacters(lines[j]).length > 200) {
          return ''
        }

        res.push(
          lineNo(j + 1)
          + truncateString(lines[j].replace(/\t/g, ' '), columns - 5 - indent),
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

function lineNo(no: number | string = '') {
  return c.gray(`${String(no).padStart(3, ' ')}| `)
}
