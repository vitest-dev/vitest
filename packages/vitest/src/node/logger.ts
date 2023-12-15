import { createLogUpdate } from 'log-update'
import c from 'picocolors'
import { version } from '../../../../package.json'
import type { ErrorWithDiff } from '../types'
import type { TypeCheckError } from '../typecheck/typechecker'
import { toArray } from '../utils'
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
  outputStream = process.stdout
  errorStream = process.stderr
  logUpdate = createLogUpdate(process.stdout)

  private _clearScreenPending: string | undefined

  constructor(
    public ctx: Vitest,
    public console = globalThis.console,
  ) {

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
    if (this.ctx.server.config.clearScreen === false) {
      this.console.log(message)
      return
    }

    this.console.log(`${ERASE_SCROLLBACK}${CLEAR_SCREEN}${message}`)
  }

  clearScreen(message: string, force = false) {
    if (this.ctx.server.config.clearScreen === false) {
      this.console.log(message)
      return
    }

    this._clearScreenPending = message
    if (force)
      this._clearScreen()
  }

  private _clearScreen() {
    if (this._clearScreenPending == null)
      return

    const log = this._clearScreenPending
    this._clearScreenPending = undefined
    this.console.log(`${CURSOR_TO_START}${ERASE_DOWN}${log}`)
  }

  printError(err: unknown, options: ErrorOptions = {}) {
    const { fullStack = false, type } = options
    const project = options.project ?? this.ctx.getCoreWorkspaceProject() ?? this.ctx.projects[0]
    return printError(err, project, {
      fullStack,
      type,
      showCodeFrame: true,
      logger: this,
    })
  }

  printNoTestFound(filters?: string[]) {
    const config = this.ctx.config
    const comma = c.dim(', ')
    if (filters?.length)
      this.console.error(c.dim('filter:  ') + c.yellow(filters.join(comma)))
    const projectsFilter = toArray(config.project)
    if (projectsFilter.length)
      this.console.error(c.dim('projects: ') + c.yellow(projectsFilter.join(comma)))
    this.ctx.projects.forEach((project) => {
      const config = project.config
      const name = project.getName()
      const output = project.isCore() || !name ? '' : `[${name}]`
      if (output)
        this.console.error(c.bgCyan(`${output} Config`))
      if (config.include)
        this.console.error(c.dim('include: ') + c.yellow(config.include.join(comma)))
      if (config.exclude)
        this.console.error(c.dim('exclude:  ') + c.yellow(config.exclude.join(comma)))
      if (config.typecheck.enabled) {
        this.console.error(c.dim('typecheck include: ') + c.yellow(config.typecheck.include.join(comma)))
        this.console.error(c.dim('typecheck exclude: ') + c.yellow(config.typecheck.exclude.join(comma)))
      }
    })
    if (config.watchExclude)
      this.console.error(c.dim('watch exclude:  ') + c.yellow(config.watchExclude.join(comma)))

    if (config.watch && (config.changed || config.related?.length)) {
      this.log(`No affected ${config.mode} files found\n`)
    }
    else {
      if (config.passWithNoTests)
        this.log(`No ${config.mode} files found, exiting with code 0\n`)
      else
        this.error(c.red(`\nNo ${config.mode} files found, exiting with code 1`))
    }
  }

  printBanner() {
    this.log()

    const versionTest = this.ctx.config.watch
      ? c.blue(`v${version}`)
      : c.cyan(`v${version}`)
    const mode = this.ctx.config.watch
      ? c.blue(' DEV ')
      : c.cyan(' RUN ')

    this.log(`${c.inverse(c.bold(mode))} ${versionTest} ${c.gray(this.ctx.config.root)}`)

    if (this.ctx.config.sequence.sequencer === RandomSequencer)
      this.log(c.gray(`      Running tests with seed "${this.ctx.config.sequence.seed}"`))

    this.ctx.projects.forEach((project) => {
      if (!project.browser)
        return
      const name = project.getName()
      const output = project.isCore() ? '' : ` [${name}]`

      this.log(c.dim(c.green(`     ${output} Browser runner started at http://${project.config.browser.api?.host || 'localhost'}:${c.bold(`${project.browser.config.server.port}`)}`)))
    })

    if (this.ctx.config.ui)
      this.log(c.dim(c.green(`      UI started at http://${this.ctx.config.api?.host || 'localhost'}:${c.bold(`${this.ctx.server.config.server.port}`)}${this.ctx.config.uiBase}`)))
    else if (this.ctx.config.api?.port)
      this.log(c.dim(c.green(`      API started at http://${this.ctx.config.api?.host || 'localhost'}:${c.bold(`${this.ctx.config.api.port}`)}`)))

    if (this.ctx.coverageProvider)
      this.log(c.dim('      Coverage enabled with ') + c.yellow(this.ctx.coverageProvider.name))

    this.log()
  }

  async printUnhandledErrors(errors: unknown[]) {
    const errorMessage = c.red(c.bold(
      `\nVitest caught ${errors.length} unhandled error${errors.length > 1 ? 's' : ''} during the test run.`
      + '\nThis might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.',
    ))
    this.log(c.red(divider(c.bold(c.inverse(' Unhandled Errors ')))))
    this.log(errorMessage)
    await Promise.all(errors.map(async (err) => {
      await this.printError(err, { fullStack: true, type: (err as ErrorWithDiff).type || 'Unhandled Error' })
    }))
    this.log(c.red(divider()))
  }

  async printSourceTypeErrors(errors: TypeCheckError[]) {
    const errorMessage = c.red(c.bold(
      `\nVitest found ${errors.length} error${errors.length > 1 ? 's' : ''} not related to your test files.`,
    ))
    this.log(c.red(divider(c.bold(c.inverse(' Source Errors ')))))
    this.log(errorMessage)
    await Promise.all(errors.map(async (err) => {
      await this.printError(err, { fullStack: true })
    }))
    this.log(c.red(divider()))
  }
}
