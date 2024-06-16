import { Console } from 'node:console'
import type { Writable } from 'node:stream'
import { createLogUpdate } from 'log-update'
import c from 'picocolors'
import type { ErrorWithDiff } from '../types'
import type { TypeCheckError } from '../typecheck/typechecker'
import { toArray } from '../utils'
import { highlightCode } from '../utils/colors'
import { divider } from './reporters/renderers/utils'
import { RandomSequencer } from './sequencers/RandomSequencer'
import type { Vitest } from './core'
import { printError } from './error'
import type { WorkspaceProject } from './workspace'

interface ErrorOptions {
  type?: string
  fullStack?: boolean
  project?: WorkspaceProject
}

const ESC = '\x1B['
const ERASE_DOWN = `${ESC}J`
const ERASE_SCROLLBACK = `${ESC}3J`
const CURSOR_TO_START = `${ESC}1;1H`
const CLEAR_SCREEN = '\x1Bc'

export class Logger {
  logUpdate: ReturnType<typeof createLogUpdate>

  private _clearScreenPending: string | undefined
  private _highlights = new Map<string, string>()
  public console: Console

  constructor(
    public ctx: Vitest,
    public outputStream: NodeJS.WriteStream | Writable = process.stdout,
    public errorStream: NodeJS.WriteStream | Writable = process.stderr,
  ) {
    this.console = new Console({ stdout: outputStream, stderr: errorStream })
    this.logUpdate = createLogUpdate(this.outputStream)
    this._highlights.clear()
  }

  log(...args: any[]) {
    this._clearScreen()
    this.console.log(...args)
  }

  error(...args: any[]) {
    this._clearScreen()
    this.console.error(...args)
  }

  warn(...args: any[]) {
    this._clearScreen()
    this.console.warn(...args)
  }

  clearFullScreen(message: string) {
    if (!this.ctx.config.clearScreen) {
      this.console.log(message)
      return
    }

    this.console.log(`${ERASE_SCROLLBACK}${CLEAR_SCREEN}${message}`)
  }

  clearScreen(message: string, force = false) {
    if (!this.ctx.config.clearScreen) {
      this.console.log(message)
      return
    }

    this._clearScreenPending = message
    if (force) {
      this._clearScreen()
    }
  }

  private _clearScreen() {
    if (this._clearScreenPending == null) {
      return
    }

    const log = this._clearScreenPending
    this._clearScreenPending = undefined
    this.console.log(`${CURSOR_TO_START}${ERASE_DOWN}${log}`)
  }

  printError(err: unknown, options: ErrorOptions = {}) {
    const { fullStack = false, type } = options
    const project
      = options.project
      ?? this.ctx.getCoreWorkspaceProject()
      ?? this.ctx.projects[0]
    printError(err, project, {
      fullStack,
      type,
      showCodeFrame: true,
      logger: this,
    })
  }

  clearHighlightCache(filename?: string) {
    if (filename) {
      this._highlights.delete(filename)
    }
    else {
      this._highlights.clear()
    }
  }

  highlight(filename: string, source: string) {
    if (this._highlights.has(filename)) {
      return this._highlights.get(filename)!
    }
    const code = highlightCode(filename, source)
    this._highlights.set(filename, code)
    return code
  }

  printNoTestFound(filters?: string[]) {
    const config = this.ctx.config
    const comma = c.dim(', ')
    if (filters?.length) {
      this.console.error(c.dim('filter:  ') + c.yellow(filters.join(comma)))
    }
    const projectsFilter = toArray(config.project)
    if (projectsFilter.length) {
      this.console.error(
        c.dim('projects: ') + c.yellow(projectsFilter.join(comma)),
      )
    }
    this.ctx.projects.forEach((project) => {
      const config = project.config
      const name = project.getName()
      const output = project.isCore() || !name ? '' : `[${name}]`
      if (output) {
        this.console.error(c.bgCyan(`${output} Config`))
      }
      if (config.include) {
        this.console.error(
          c.dim('include: ') + c.yellow(config.include.join(comma)),
        )
      }
      if (config.exclude) {
        this.console.error(
          c.dim('exclude:  ') + c.yellow(config.exclude.join(comma)),
        )
      }
      if (config.typecheck.enabled) {
        this.console.error(
          c.dim('typecheck include: ')
          + c.yellow(config.typecheck.include.join(comma)),
        )
        this.console.error(
          c.dim('typecheck exclude: ')
          + c.yellow(config.typecheck.exclude.join(comma)),
        )
      }
    })

    if (config.watch && (config.changed || config.related?.length)) {
      this.log(`No affected ${config.mode} files found\n`)
    }
    else {
      if (config.passWithNoTests) {
        this.log(`No ${config.mode} files found, exiting with code 0\n`)
      }
      else {
        this.error(
          c.red(`\nNo ${config.mode} files found, exiting with code 1`),
        )
      }
    }
  }

  printBanner() {
    this.log()

    const versionTest = this.ctx.config.watch
      ? c.blue(`v${this.ctx.version}`)
      : c.cyan(`v${this.ctx.version}`)
    const mode = this.ctx.config.watch ? c.blue(' DEV ') : c.cyan(' RUN ')

    this.log(
      `${c.inverse(c.bold(mode))} ${versionTest} ${c.gray(
        this.ctx.config.root,
      )}`,
    )

    if (this.ctx.config.sequence.sequencer === RandomSequencer) {
      this.log(
        c.gray(
          `      Running tests with seed "${this.ctx.config.sequence.seed}"`,
        ),
      )
    }

    this.ctx.projects.forEach((project) => {
      if (!project.browser) {
        return
      }
      const name = project.getName()
      const output = project.isCore() ? '' : ` [${name}]`

      const resolvedUrls = project.browser.resolvedUrls
      const origin = resolvedUrls?.local[0] ?? resolvedUrls?.network[0]
      this.log(
        c.dim(
          c.green(
            `     ${output} Browser runner started at ${new URL('/', origin)}`,
          ),
        ),
      )
    })

    if (this.ctx.config.ui) {
      this.log(
        c.dim(
          c.green(
            `      UI started at http://${
              this.ctx.config.api?.host || 'localhost'
            }:${c.bold(`${this.ctx.server.config.server.port}`)}${
              this.ctx.config.uiBase
            }`,
          ),
        ),
      )
    }
    else if (this.ctx.config.api?.port) {
      const resolvedUrls = this.ctx.server.resolvedUrls
      // workaround for https://github.com/vitejs/vite/issues/15438, it was fixed in vite 5.1
      const fallbackUrl = `http://${this.ctx.config.api.host || 'localhost'}:${
        this.ctx.config.api.port
      }`
      const origin
        = resolvedUrls?.local[0] ?? resolvedUrls?.network[0] ?? fallbackUrl
      this.log(c.dim(c.green(`      API started at ${new URL('/', origin)}`)))
    }

    if (this.ctx.coverageProvider) {
      this.log(
        c.dim('      Coverage enabled with ')
        + c.yellow(this.ctx.coverageProvider.name),
      )
    }

    if (this.ctx.config.standalone) {
      this.log(
        c.yellow(
          `\nVitest is running in standalone mode. Edit a test file to rerun tests.`,
        ),
      )
    }
    else {
      this.log()
    }
  }

  printUnhandledErrors(errors: unknown[]) {
    const errorMessage = c.red(
      c.bold(
        `\nVitest caught ${errors.length} unhandled error${
          errors.length > 1 ? 's' : ''
        } during the test run.`
        + '\nThis might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.',
      ),
    )
    this.log(c.red(divider(c.bold(c.inverse(' Unhandled Errors ')))))
    this.log(errorMessage)
    errors.forEach((err) => {
      this.printError(err, {
        fullStack: true,
        type: (err as ErrorWithDiff).type || 'Unhandled Error',
      })
    })
    this.log(c.red(divider()))
  }

  printSourceTypeErrors(errors: TypeCheckError[]) {
    const errorMessage = c.red(
      c.bold(
        `\nVitest found ${errors.length} error${
          errors.length > 1 ? 's' : ''
        } not related to your test files.`,
      ),
    )
    this.log(c.red(divider(c.bold(c.inverse(' Source Errors ')))))
    this.log(errorMessage)
    errors.forEach((err) => {
      this.printError(err, { fullStack: true })
    })
    this.log(c.red(divider()))
  }
}
