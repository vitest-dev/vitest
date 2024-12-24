import type { RawSourceMap } from '@ampproject/remapping'
import type { File, Task, TaskResultPack, TaskState } from '@vitest/runner'
import type { ParsedStack } from '@vitest/utils'
import type { EachMapping } from '@vitest/utils/source-map'
import type { ChildProcess } from 'node:child_process'
import type { Vitest } from '../node/core'
import type { TestProject } from '../node/project'
import type { Awaitable } from '../types/general'
import type { FileInformation } from './collect'
import type { TscErrorInfo } from './types'
import { rm } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { getTasks } from '@vitest/runner/utils'
import { eachMapping, generatedPositionFor, TraceMap } from '@vitest/utils/source-map'
import { basename, extname, resolve } from 'pathe'
import { x } from 'tinyexec'
import { collectTests } from './collect'
import { getRawErrsMapFromTsCompile, getTsconfig } from './parse'
import { createIndexMap } from './utils'

export class TypeCheckError extends Error {
  name = 'TypeCheckError'

  constructor(public message: string, public stacks: ParsedStack[]) {
    super(message)
  }
}

export interface TypecheckResults {
  files: File[]
  sourceErrors: TypeCheckError[]
  time: number
}

type Callback<Args extends Array<any> = []> = (
  ...args: Args
) => Awaitable<void>

export class Typechecker {
  private _onParseStart?: Callback
  private _onParseEnd?: Callback<[TypecheckResults]>
  private _onWatcherRerun?: Callback
  private _result: TypecheckResults = {
    files: [],
    sourceErrors: [],
    time: 0,
  }

  private _startTime = 0
  private _output = ''
  private _tests: Record<string, FileInformation> | null = {}
  private tempConfigPath?: string
  private allowJs?: boolean
  private process?: ChildProcess

  protected files: string[] = []

  constructor(protected ctx: TestProject) {}

  public setFiles(files: string[]) {
    this.files = files
  }

  public onParseStart(fn: Callback) {
    this._onParseStart = fn
  }

  public onParseEnd(fn: Callback<[TypecheckResults]>) {
    this._onParseEnd = fn
  }

  public onWatcherRerun(fn: Callback) {
    this._onWatcherRerun = fn
  }

  protected async collectFileTests(
    filepath: string,
  ): Promise<FileInformation | null> {
    return collectTests(this.ctx, filepath)
  }

  protected getFiles() {
    return this.files.filter((filename) => {
      const extension = extname(filename)
      return extension !== '.js' || this.allowJs
    })
  }

  public async collectTests() {
    const tests = (
      await Promise.all(
        this.getFiles().map(filepath => this.collectFileTests(filepath)),
      )
    ).reduce((acc, data) => {
      if (!data) {
        return acc
      }
      acc[data.filepath] = data
      return acc
    }, {} as Record<string, FileInformation>)
    this._tests = tests
    return tests
  }

  protected markPassed(file: File) {
    if (!file.result?.state) {
      file.result = {
        state: 'pass',
      }
    }
    const markTasks = (tasks: Task[]): void => {
      for (const task of tasks) {
        if ('tasks' in task) {
          markTasks(task.tasks)
        }
        if (!task.result?.state && (task.mode === 'run' || task.mode === 'queued')) {
          task.result = {
            state: 'pass',
          }
        }
      }
    }
    markTasks(file.tasks)
  }

  protected async prepareResults(output: string) {
    const typeErrors = await this.parseTscLikeOutput(output)
    const testFiles = new Set(this.getFiles())

    if (!this._tests) {
      this._tests = await this.collectTests()
    }

    const sourceErrors: TypeCheckError[] = []
    const files: File[] = []

    testFiles.forEach((path) => {
      const { file, definitions, map, parsed } = this._tests![path]
      const errors = typeErrors.get(path)
      files.push(file)
      if (!errors) {
        this.markPassed(file)
        return
      }
      const sortedDefinitions = [
        ...definitions.sort((a, b) => b.start - a.start),
      ]
      // has no map for ".js" files that use // @ts-check
      const traceMap = (map && new TraceMap(map as unknown as RawSourceMap))
      const indexMap = createIndexMap(parsed)
      const markState = (task: Task, state: TaskState) => {
        task.result = {
          state:
            task.mode === 'run' || task.mode === 'only' ? state : task.mode,
        }
        if (task.suite) {
          markState(task.suite, state)
        }
        else if (task.file && task !== task.file) {
          markState(task.file, state)
        }
      }
      errors.forEach(({ error, originalError }) => {
        const processedPos = traceMap
          ? findGeneratePosition(traceMap, {
            line: originalError.line,
            column: originalError.column,
            source: basename(path),
          })
          : originalError
        const line = processedPos.line ?? originalError.line
        const column = processedPos.column ?? originalError.column
        const index = indexMap.get(`${line}:${column}`)
        const definition
          = index != null
          && sortedDefinitions.find(
            def => def.start <= index && def.end >= index,
          )
        const suite = definition ? definition.task : file
        const state: TaskState
          = suite.mode === 'run' || suite.mode === 'only' ? 'fail' : suite.mode
        const errors = suite.result?.errors || []
        suite.result = {
          state,
          errors,
        }
        errors.push(error)
        if (state === 'fail') {
          if (suite.suite) {
            markState(suite.suite, 'fail')
          }
          else if (suite.file && suite !== suite.file) {
            markState(suite.file, 'fail')
          }
        }
      })

      this.markPassed(file)
    })

    typeErrors.forEach((errors, path) => {
      if (!testFiles.has(path)) {
        sourceErrors.push(...errors.map(({ error }) => error))
      }
    })

    return {
      files,
      sourceErrors,
      time: performance.now() - this._startTime,
    }
  }

  protected async parseTscLikeOutput(output: string) {
    const errorsMap = await getRawErrsMapFromTsCompile(output)
    const typesErrors = new Map<
      string,
      { error: TypeCheckError; originalError: TscErrorInfo }[]
    >()
    errorsMap.forEach((errors, path) => {
      const filepath = resolve(this.ctx.config.root, path)
      const suiteErrors = errors.map((info) => {
        const limit = Error.stackTraceLimit
        Error.stackTraceLimit = 0
        // Some expect-type errors have the most useful information on the second line e.g. `This expression is not callable.\n  Type 'ExpectString<number>' has no call signatures.`
        const errMsg = info.errMsg.replace(
          /\r?\n\s*(Type .* has no call signatures)/g,
          ' $1',
        )
        const error = new TypeCheckError(errMsg, [
          {
            file: filepath,
            line: info.line,
            column: info.column,
            method: '',
          },
        ])
        Error.stackTraceLimit = limit
        return {
          originalError: info,
          error: {
            name: error.name,
            nameStr: String(error.name),
            message: errMsg,
            stacks: error.stacks,
            stack: '',
            stackStr: '',
          },
        }
      })
      typesErrors.set(filepath, suiteErrors)
    })
    return typesErrors
  }

  public async clear() {
    if (this.tempConfigPath) {
      await rm(this.tempConfigPath, { force: true })
    }
  }

  public async stop() {
    await this.clear()
    this.process?.kill()
    this.process = undefined
  }

  protected async ensurePackageInstalled(ctx: Vitest, checker: string) {
    if (checker !== 'tsc' && checker !== 'vue-tsc') {
      return
    }
    const packageName = checker === 'tsc' ? 'typescript' : 'vue-tsc'
    await ctx.packageInstaller.ensureInstalled(packageName, ctx.config.root)
  }

  public async prepare() {
    const { root, typecheck } = this.ctx.config

    const { config, path } = await getTsconfig(root, typecheck)

    this.tempConfigPath = path
    this.allowJs = typecheck.allowJs || config.allowJs || false
  }

  public getExitCode() {
    return this.process?.exitCode != null && this.process.exitCode
  }

  public getOutput() {
    return this._output
  }

  public async start() {
    if (this.process) {
      return
    }

    if (!this.tempConfigPath) {
      throw new Error('tsconfig was not initialized')
    }

    const { root, watch, typecheck } = this.ctx.config

    const args = ['--noEmit', '--pretty', 'false', '-p', this.tempConfigPath]
    // use builtin watcher, because it's faster
    if (watch) {
      args.push('--watch')
    }
    if (typecheck.allowJs) {
      args.push('--allowJs', '--checkJs')
    }
    this._output = ''
    this._startTime = performance.now()
    const child = x(typecheck.checker, args, {
      nodeOptions: {
        cwd: root,
        stdio: 'pipe',
      },
      throwOnError: false,
    })
    this.process = child.process
    await this._onParseStart?.()
    let rerunTriggered = false
    child.process?.stdout?.on('data', (chunk) => {
      this._output += chunk
      if (!watch) {
        return
      }
      if (this._output.includes('File change detected') && !rerunTriggered) {
        this._onWatcherRerun?.()
        this._startTime = performance.now()
        this._result.sourceErrors = []
        this._result.files = []
        this._tests = null // test structure might've changed
        rerunTriggered = true
      }
      if (/Found \w+ errors*. Watching for/.test(this._output)) {
        rerunTriggered = false
        this.prepareResults(this._output).then((result) => {
          this._result = result
          this._onParseEnd?.(result)
        })
        this._output = ''
      }
    })
    if (!watch) {
      await child
      this._result = await this.prepareResults(this._output)
      await this._onParseEnd?.(this._result)
    }
  }

  public getResult() {
    return this._result
  }

  public getTestFiles() {
    return Object.values(this._tests || {}).map(i => i.file)
  }

  public getTestPacks() {
    return Object.values(this._tests || {})
      .map(({ file }) => getTasks(file))
      .flat()
      .map<TaskResultPack>(i => [i.id, i.result, { typecheck: true }])
  }
}

function findGeneratePosition(traceMap: TraceMap, { line, column, source }: { line: number; column: number; source: string }) {
  const found = generatedPositionFor(traceMap, {
    line,
    column,
    source,
  })
  if (found.line !== null) {
    return found
  }
  // find the next source token position when the exact error position doesn't exist in source map.
  // this can happen, for example, when the type error is in the comment "// @ts-expect-error"
  // and comments are stripped away in the generated code.
  const mappings: (EachMapping & { originalLine: number })[] = []
  eachMapping(traceMap, (m) => {
    if (m.source === source && m.originalLine !== null && m.originalColumn !== null && (line < m.originalLine || (line === m.originalLine && column <= m.originalColumn))) {
      mappings.push(m)
    }
  })
  const next = mappings.sort((a, b) => a.originalLine === b.originalLine ? a.originalColumn - b.originalColumn : a.originalLine - b.originalLine).at(0)
  if (next) {
    return {
      line: next.generatedLine,
      column: next.generatedColumn,
    }
  }
  return { line: null, column: null }
}
