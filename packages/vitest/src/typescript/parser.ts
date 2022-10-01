import { execaCommand } from 'execa'
import mm from 'micromatch'
import { resolve } from 'pathe'
import type { Awaitable, ParsedStack, TscErrorInfo } from '../types'
import { TYPECHECK_ERROR } from './constants'
import { getRawErrsMapFromTsCompile, getTsconfigPath } from './parse'

interface OutputOptions {
  watch: boolean
  root: string
  include: string[]
  checker: 'tsc' | 'vue-tsc'
}

const originSymbol = Symbol('typechecker:origin')

export class TypeCheckError extends Error {
  [TYPECHECK_ERROR] = true;
  [originSymbol] = 'test'
  stacks: ParsedStack[] = []

  constructor(public message: string, origin: 'test' | 'source') {
    super(message)
    this[originSymbol] = origin
  }

  getOrigin() {
    return this[originSymbol]
  }
}

interface SuiteError {
  path: string
  originalError: TscErrorInfo
  error: TypeCheckError
}

type Callback<Args extends Array<any> = []> = (...args: Args) => Awaitable<void> // TODO

export class Typechecker {
  private _onParseStart?: Callback
  private _onParseEnd?: Callback<[SuiteError[]]>
  private _onWatcherRerun?: Callback

  constructor(private options: OutputOptions) {}

  public onParseStart(fn: Callback) {
    this._onParseStart = fn
  }

  public onParseEnd(fn: Callback<[SuiteError[]]>) {
    this._onParseEnd = fn
  }

  public onWatcherRerun(fn: Callback) {
    this._onWatcherRerun = fn
  }

  private async parse(output: string): Promise<SuiteError[]> {
    // check tsc or vue-tsc installed
    const errorsMap = await getRawErrsMapFromTsCompile(output)
    const errorsList: SuiteError[] = []
    const pattern = ['**/*.test-d.ts']
    const testFiles = new Set(mm([...errorsMap.keys()], pattern))
    errorsMap.forEach((errors, path) => {
      const filepath = resolve(this.options.root, path)
      const suiteErrors = errors.map((info) => {
        const limit = Error.stackTraceLimit
        Error.stackTraceLimit = 0
        const origin = testFiles.has(path) ? 'test' : 'source'
        const error = new TypeCheckError(info.errMsg, origin)
        Error.stackTraceLimit = limit
        error.stacks = [
          {
            file: filepath,
            line: info.line,
            column: info.column,
            method: '', // TODO, build error based on method
            sourcePos: {
              line: info.line,
              column: info.column,
            },
          },
        ]
        return {
          error,
          path,
          originalError: info,
        }
      })
      errorsList.push(...suiteErrors)
    })
    return errorsList
  }

  public async start() {
    const tmpConfigPath = await getTsconfigPath(this.options.root)
    let cmd = `${this.options.checker} --noEmit --pretty false -p ${tmpConfigPath}`
    if (this.options.watch)
      cmd += ' --watch'
    let output = ''
    const stdout = execaCommand(cmd, {
      cwd: this.options.root,
      stdout: 'pipe',
      reject: false,
    })
    await this._onParseStart?.()
    let rerunTriggered = false
    stdout.stdout?.on('data', (chunk) => {
      output += chunk
      if (!this.options.watch)
        return
      if (output.includes('File change detected') && !rerunTriggered) {
        this._onWatcherRerun?.()
        rerunTriggered = true
      }
      if (/Found \w+ errors. Watching for/.test(output)) {
        rerunTriggered = false
        this.parse(output).then((errors) => {
          this._onParseEnd?.(errors)
        })
        output = ''
      }
    })
    if (!this.options.watch) {
      await stdout
      await this._onParseEnd?.(await this.parse(output))
    }
  }
}
