import { execaCommand } from 'execa'
import { relative, resolve } from 'pathe'
import type { Awaitable, File, ParsedStack, TypeCheck, Vitest } from '../types'
import { TYPECHECK_ERROR } from './constants'
import { getRawErrsMapFromTsCompile, getTsconfigPath } from './parse'

export class TypeCheckError extends Error {
  [TYPECHECK_ERROR] = true
  stacks: ParsedStack[] = []
  name = 'TypeCheckError'

  constructor(public message: string) {
    super(message)
  }
}

interface ErrorsCache {
  files: File[]
  sourceErrors: TypeCheckError[]
}

type Callback<Args extends Array<any> = []> = (...args: Args) => Awaitable<void>

export class Typechecker {
  private _onParseStart?: Callback
  private _onParseEnd?: Callback<[ErrorsCache]>
  private _onWatcherRerun?: Callback

  private _result: ErrorsCache = {
    files: [],
    sourceErrors: [],
  }

  constructor(protected ctx: Vitest, protected files: string[]) {}

  public onParseStart(fn: Callback) {
    this._onParseStart = fn
  }

  public onParseEnd(fn: Callback<[ErrorsCache]>) {
    this._onParseEnd = fn
  }

  public onWatcherRerun(fn: Callback) {
    this._onWatcherRerun = fn
  }

  protected async prepareResults(output: string) {
    const typeErrors = await this.parseTscLikeOutput(output)
    const testFiles = new Set(this.files.map(f => relative(this.ctx.config.root, f)))

    const files: File[] = []

    testFiles.forEach((path) => { // TODO parse files to create tasks
      const errors = typeErrors.get(path)
      const suite: File = {
        type: 'suite',
        filepath: path,
        tasks: [],
        id: path,
        name: path,
        mode: 'run',
      }
      if (!errors) {
        return files.push({
          ...suite,
          result: {
            state: 'pass',
          },
        })
      }
      const tasks = errors.map((error, idx) => {
        const task: TypeCheck = {
          type: 'typecheck',
          id: idx.toString(),
          name: `error expect ${idx + 1}`,
          mode: 'run',
          file: suite,
          suite,
          result: {
            state: 'fail',
            error,
          },
        }
        return task
      })
      suite.tasks = tasks
      files.push({
        ...suite,
        result: {
          state: 'fail',
        },
      })
    })

    const sourceErrors: TypeCheckError[] = []

    typeErrors.forEach((errors, path) => {
      if (!testFiles.has(path))
        sourceErrors.push(...errors)
    })

    return {
      files,
      sourceErrors,
    }
  }

  protected async parseTscLikeOutput(output: string) {
    const errorsMap = await getRawErrsMapFromTsCompile(output)
    const typesErrors = new Map<string, TypeCheckError[]>()
    errorsMap.forEach((errors, path) => {
      const filepath = resolve(this.ctx.config.root, path)
      const suiteErrors = errors.map((info) => {
        const limit = Error.stackTraceLimit
        Error.stackTraceLimit = 0
        const error = new TypeCheckError(info.errMsg)
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
        return error
      })
      typesErrors.set(path, suiteErrors)
    })
    return typesErrors
  }

  public async start() {
    // check tsc or vue-tsc installed
    const tmpConfigPath = await getTsconfigPath(this.ctx.config.root)
    let cmd = `${this.ctx.config.typecheck.checker} --noEmit --pretty false -p ${tmpConfigPath}`
    if (this.ctx.config.watch)
      cmd += ' --watch'
    let output = ''
    const stdout = execaCommand(cmd, {
      cwd: this.ctx.config.root,
      stdout: 'pipe',
      reject: false,
    })
    await this._onParseStart?.()
    let rerunTriggered = false
    stdout.stdout?.on('data', (chunk) => {
      output += chunk
      if (!this.ctx.config.watch)
        return
      if (output.includes('File change detected') && !rerunTriggered) {
        this._onWatcherRerun?.()
        this._result = {
          sourceErrors: [],
          files: [],
        }
        rerunTriggered = true
      }
      if (/Found \w+ errors*. Watching for/.test(output)) {
        rerunTriggered = false
        this.prepareResults(output).then((errors) => {
          this._result = errors
          this._onParseEnd?.(errors)
        })
        output = ''
      }
    })
    if (!this.ctx.config.watch) {
      await stdout
      this._result = await this.prepareResults(output)
      await this._onParseEnd?.(this._result)
    }
  }

  public getResult() {
    return this._result
  }
}
