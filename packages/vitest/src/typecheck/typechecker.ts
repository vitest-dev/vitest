import { rm } from 'fs/promises'
import type { ExecaChildProcess } from 'execa'
import { execa } from 'execa'
import { resolve } from 'pathe'
import { SourceMapConsumer } from 'source-map'
import { ensurePackageInstalled } from '../utils'
import type { Awaitable, File, ParsedStack, Task, TaskState, TscErrorInfo, Vitest } from '../types'
import { getRawErrsMapFromTsCompile, getTsconfigPath } from './parse'
import { createIndexMap } from './utils'
import type { FileInformation } from './collect'
import { collectTests } from './collect'

export class TypeCheckError extends Error {
  name = 'TypeCheckError'

  constructor(public message: string, public stacks: ParsedStack[]) {
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

  private _tests: Record<string, FileInformation> | null = {}
  private tempConfigPath?: string
  private process!: ExecaChildProcess

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

  protected async collectFileTests(filepath: string): Promise<FileInformation | null> {
    return collectTests(this.ctx, filepath)
  }

  public async collectTests() {
    const tests = (await Promise.all(
      this.files.map(filepath => this.collectFileTests(filepath)),
    )).reduce((acc, data) => {
      if (!data)
        return acc
      acc[data.filepath] = data
      return acc
    }, {} as Record<string, FileInformation>)
    this._tests = tests
    return tests
  }

  protected async prepareResults(output: string) {
    const typeErrors = await this.parseTscLikeOutput(output)
    const testFiles = new Set(this.files)

    if (!this._tests)
      this._tests = await this.collectTests()

    const sourceErrors: TypeCheckError[] = []
    const files: File[] = []

    testFiles.forEach((path) => {
      const { file, definitions, map, parsed } = this._tests![path]
      const errors = typeErrors.get(path)
      files.push(file)
      if (!errors)
        return
      const sortedDefinitions = [...definitions.sort((a, b) => b.start - a.start)]
      // has no map for ".js" files that use // @ts-check
      const mapConsumer = map && new SourceMapConsumer(map)
      const indexMap = createIndexMap(parsed)
      const markFailed = (task: Task) => {
        task.result = {
          state: task.mode === 'run' || task.mode === 'only' ? 'fail' : task.mode,
        }
        if (task.suite)
          markFailed(task.suite)
      }
      errors.forEach(({ error, originalError }, idx) => {
        const originalPos = mapConsumer?.generatedPositionFor({
          line: originalError.line,
          column: originalError.column,
          source: path,
        }) || originalError
        const index = indexMap.get(`${originalPos.line}:${originalPos.column}`)
        const definition = (index != null && sortedDefinitions.find(def => def.start <= index && def.end >= index)) || file
        const suite = 'task' in definition ? definition.task : definition
        const state: TaskState = suite.mode === 'run' || suite.mode === 'only' ? 'fail' : suite.mode
        const task: Task = {
          type: 'typecheck',
          id: idx.toString(),
          name: `error expect ${idx + 1}`, // TODO naming
          mode: suite.mode,
          file,
          suite,
          result: {
            state,
            error: state === 'fail' ? error : undefined,
          },
        }
        if (state === 'fail')
          markFailed(suite)
        suite.tasks.push(task)
      })
    })

    typeErrors.forEach((errors, path) => {
      if (!testFiles.has(path))
        sourceErrors.push(...errors.map(({ error }) => error))
    })

    return {
      files,
      sourceErrors,
    }
  }

  protected async parseTscLikeOutput(output: string) {
    const errorsMap = await getRawErrsMapFromTsCompile(output)
    const typesErrors = new Map<string, { error: TypeCheckError; originalError: TscErrorInfo }[]>()
    errorsMap.forEach((errors, path) => {
      const filepath = resolve(this.ctx.config.root, path)
      const suiteErrors = errors.map((info) => {
        const limit = Error.stackTraceLimit
        Error.stackTraceLimit = 0
        const error = new TypeCheckError(info.errMsg, [
          {
            file: filepath,
            line: info.line,
            column: info.column,
            method: '',
            sourcePos: {
              line: info.line,
              column: info.column,
            },
          },
        ])
        Error.stackTraceLimit = limit
        return {
          originalError: info,
          error,
        }
      })
      typesErrors.set(filepath, suiteErrors)
    })
    return typesErrors
  }

  public async clear() {
    if (this.tempConfigPath)
      await rm(this.tempConfigPath, { force: true })
  }

  public async stop() {
    await this.clear()
    this.process?.kill()
  }

  protected async ensurePackageInstalled(root: string, checker: string) {
    if (checker !== 'tsc' && checker !== 'vue-tsc')
      return
    const packageName = checker === 'tsc' ? 'typescript' : 'vue-tsc'
    await ensurePackageInstalled(packageName, root)
  }

  public async start() {
    const { root, watch, typecheck } = this.ctx.config
    await this.ensurePackageInstalled(root, typecheck.checker)

    this.tempConfigPath = await getTsconfigPath(root, typecheck)
    const args = ['--noEmit', '--pretty', 'false', '-p', this.tempConfigPath]
    // use builtin watcher, because it's faster
    if (watch)
      args.push('--watch')
    if (typecheck.allowJs)
      args.push('--allowJs', '--checkJs')
    let output = ''
    const child = execa(typecheck.checker, args, {
      cwd: root,
      stdout: 'pipe',
      reject: false,
    })
    this.process = child
    await this._onParseStart?.()
    let rerunTriggered = false
    child.stdout?.on('data', (chunk) => {
      output += chunk
      if (!watch)
        return
      if (output.includes('File change detected') && !rerunTriggered) {
        this._onWatcherRerun?.()
        this._result.sourceErrors = []
        this._result.files = []
        this._tests = null // test structure migh've changed
        rerunTriggered = true
      }
      if (/Found \w+ errors*. Watching for/.test(output)) {
        rerunTriggered = false
        this.prepareResults(output).then((result) => {
          this._result = result
          this._onParseEnd?.(result)
        })
        output = ''
      }
    })
    if (!watch) {
      await child
      this._result = await this.prepareResults(output)
      await this._onParseEnd?.(this._result)
      await this.clear()
    }
  }

  public getResult() {
    return this._result
  }

  public getTestFiles() {
    return Object.values(this._tests || {}).map(i => i.file)
  }
}
