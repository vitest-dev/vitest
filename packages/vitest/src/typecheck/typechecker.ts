import { rm } from 'node:fs/promises'
import type { ExecaChildProcess } from 'execa'
import { execa } from 'execa'
import { extname, resolve } from 'pathe'
import { SourceMapConsumer } from 'source-map'
import { getTasks } from '../utils'
import { ensurePackageInstalled } from '../node/pkg'
import type { Awaitable, File, ParsedStack, Task, TaskResultPack, TaskState, TscErrorInfo, Vitest } from '../types'
import { getRawErrsMapFromTsCompile, getTsconfig } from './parse'
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
  private allowJs?: boolean
  private process!: ExecaChildProcess

  constructor(protected ctx: Vitest, protected files: string[]) { }

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

  protected getFiles() {
    return this.files.filter((filename) => {
      const extension = extname(filename)
      return extension !== '.js' || this.allowJs
    })
  }

  public async collectTests() {
    const tests = (await Promise.all(
      this.getFiles().map(filepath => this.collectFileTests(filepath)),
    )).reduce((acc, data) => {
      if (!data)
        return acc
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
        if ('tasks' in task)
          markTasks(task.tasks)
        if (!task.result?.state && task.mode === 'run') {
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

    if (!this._tests)
      this._tests = await this.collectTests()

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
      const sortedDefinitions = [...definitions.sort((a, b) => b.start - a.start)]
      // has no map for ".js" files that use // @ts-check
      const mapConsumer = map && new SourceMapConsumer(map)
      const indexMap = createIndexMap(parsed)
      const markState = (task: Task, state: TaskState) => {
        task.result = {
          state: (task.mode === 'run' || task.mode === 'only') ? state : task.mode,
        }
        if (task.suite)
          markState(task.suite, state)
      }
      errors.forEach(({ error, originalError }) => {
        const processedPos = mapConsumer?.generatedPositionFor({
          line: originalError.line,
          column: originalError.column,
          source: path,
        }) || originalError
        const line = processedPos.line ?? originalError.line
        const column = processedPos.column ?? originalError.column
        const index = indexMap.get(`${line}:${column}`)
        const definition = (index != null && sortedDefinitions.find(def => def.start <= index && def.end >= index))
        const suite = definition ? definition.task : file
        const state: TaskState = (suite.mode === 'run' || suite.mode === 'only') ? 'fail' : suite.mode
        const errors = suite.result?.errors || []
        suite.result = {
          state,
          errors,
        }
        errors.push(error)
        if (state === 'fail' && suite.suite)
          markState(suite.suite, 'fail')
      })

      this.markPassed(file)
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

  public async prepare() {
    const { root, typecheck } = this.ctx.config
    await this.ensurePackageInstalled(root, typecheck.checker)

    const { config, path } = await getTsconfig(root, typecheck)

    this.tempConfigPath = path
    this.allowJs = typecheck.allowJs || config.allowJs || false
  }

  public async start() {
    if (!this.tempConfigPath)
      throw new Error('tsconfig was not initialized')

    const { root, watch, typecheck } = this.ctx.config

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
        this._tests = null // test structure might've changed
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
      .map(i => [i.id, undefined] as TaskResultPack)
  }
}
