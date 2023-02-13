import { createLogUpdate } from 'log-update'
import c from 'picocolors'
import { version } from '../../../../package.json'
import type { ErrorWithDiff } from '../types'
import type { TypeCheckError } from '../typecheck/typechecker'
import { divider } from './reporters/renderers/utils'
import type { Vitest } from './core'
import { printError } from './error'

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

    this.console.log(`\x1Bc${message}`)
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
    // equivalent to ansi-escapes:
    // stdout.write(ansiEscapes.cursorTo(0, 0) + ansiEscapes.eraseDown + log)
    this.console.log(`\u001B[1;1H\u001B[J${log}`)
  }

  printError(err: unknown, fullStack = false, type?: string) {
    return printError(err, this.ctx, {
      fullStack,
      type,
      showCodeFrame: true,
    })
  }

  printNoTestFound(filters?: string[]) {
    const config = this.ctx.config
    const comma = c.dim(', ')
    if (filters?.length)
      this.console.error(c.dim('filter:  ') + c.yellow(filters.join(comma)))
    if (config.include)
      this.console.error(c.dim('include: ') + c.yellow(config.include.join(comma)))
    if (config.exclude)
      this.console.error(c.dim('exclude:  ') + c.yellow(config.exclude.join(comma)))
    if (config.watchExclude)
      this.console.error(c.dim('watch exclude:  ') + c.yellow(config.watchExclude.join(comma)))

    if (config.passWithNoTests)
      this.log(`No ${config.mode} files found, exiting with code 0\n`)
    else
      this.error(c.red(`\nNo ${config.mode} files found, exiting with code 1`))
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

    if (this.ctx.config.browser)
      this.log(c.dim(c.green(`      Browser runner started at http://${this.ctx.config.api?.host || 'localhost'}:${c.bold(`${this.ctx.server.config.server.port}`)}`)))
    else if (this.ctx.config.ui)
      this.log(c.dim(c.green(`      UI started at http://${this.ctx.config.api?.host || 'localhost'}:${c.bold(`${this.ctx.server.config.server.port}`)}${this.ctx.config.uiBase}`)))
    else if (this.ctx.config.api)
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
      await this.printError(err, true, (err as ErrorWithDiff).type || 'Unhandled Error')
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
      await this.printError(err, true)
    }))
    this.log(c.red(divider()))
  }
}
