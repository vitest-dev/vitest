import { readFile } from 'fs/promises'
import { execaCommand } from 'execa'
import { resolve } from 'pathe'
import { parse as parseAst } from 'acorn'
import { ancestor as walkAst } from 'acorn-walk'
import type { RawSourceMap } from 'vite-node'
import { SourceMapConsumer } from 'source-map-js'
import type { Awaitable, File, ParsedStack, Suite, TscErrorInfo, Vitest } from '../types'
import { TYPECHECK_ERROR } from './constants'
import { getRawErrsMapFromTsCompile, getTsconfigPath } from './parse'
import { createIndexMap } from './utils'

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

interface ParsedFile extends File {
  start: number
  end: number
}

interface ParsedSuite extends Suite {
  start: number
  end: number
}

interface LocalCallDefinition {
  start: number
  end: number
  name: string
  type: string
  mode: 'run' | 'skip' | 'only' | 'todo'
  task: ParsedSuite | ParsedFile
}

interface FileInformation {
  file: ParsedFile
  content: string
  filepath: string
  parsed: string
  map: RawSourceMap | null
  definitions: LocalCallDefinition[]
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

  protected async parseTestFile(filepath: string): Promise<FileInformation | null> {
    const [request, content] = await Promise.all([
      this.ctx.vitenode.transformRequest(filepath),
      readFile(filepath, 'utf-8'),
    ])
    if (!request)
      return null
    const ast = parseAst(request.code, {
      ecmaVersion: 'latest',
      allowAwaitOutsideFunction: true,
    })
    const file: ParsedFile = {
      filepath,
      type: 'suite',
      id: '-1',
      name: filepath,
      mode: 'run',
      tasks: [],
      start: ast.start,
      end: ast.end,
      result: {
        state: 'pass',
      },
    }
    const definitions: LocalCallDefinition[] = []
    const getName = (callee: any): string | null => {
      if (!callee)
        return null
      if (callee.type === 'Identifier')
        return callee.name
      if (callee.type === 'MemberExpression') {
        // direct call as `__vite_ssr__.test()`
        if (callee.object?.name?.startsWith('__vite_ssr_'))
          return getName(callee.property)
        return getName(callee.object?.property)
      }
      return null
    }
    walkAst(ast, {
      CallExpression(node) {
        const { callee } = node as any
        const name = getName(callee)
        if (!name)
          return
        if (!['it', 'test', 'describe', 'suite'].includes(name))
          return
        const { arguments: [{ value: message }] } = node as any
        const property = callee?.property?.name
        const mode = !property || property === name ? 'run' : property
        if (mode === 'each')
          throw new Error(`${name}.each syntax is not supported when testing types`)
        definitions.push({
          start: node.start,
          end: node.end,
          name: message,
          type: name,
          mode,
        } as LocalCallDefinition)
      },
    })
    let lastSuite: ParsedSuite = file
    const getLatestSuite = (index: number) => {
      const suite = lastSuite
      while (lastSuite !== file && lastSuite.end < index)
        lastSuite = suite.suite as ParsedSuite
      return lastSuite
    }
    definitions.sort((a, b) => a.start - b.start).forEach((definition, idx) => {
      const latestSuite = getLatestSuite(definition.start)
      const state = definition.mode === 'run' ? 'pass' : definition.mode
      if (definition.type === 'describe' || definition.type === 'suite') {
        const suite: ParsedSuite = {
          type: 'suite',
          id: idx.toString(),
          mode: definition.mode,
          name: definition.name,
          suite: latestSuite,
          tasks: [],
          result: {
            state,
          },
          start: definition.start,
          end: definition.end,
        }
        definition.task = suite
        latestSuite.tasks.push(suite)
        lastSuite = suite
        return
      }
      const task: ParsedSuite = {
        type: 'suite',
        id: idx.toString(),
        suite: latestSuite,
        file,
        tasks: [],
        mode: definition.mode,
        name: definition.name,
        end: definition.end,
        result: {
          state,
        },
        start: definition.start,
      }
      definition.task = task
      latestSuite.tasks.push(task)
    })
    return {
      file,
      parsed: request.code,
      content,
      filepath,
      map: request.map as RawSourceMap | null,
      definitions,
    }
  }

  protected async prepareResults(output: string) {
    const typeErrors = await this.parseTscLikeOutput(output)
    const testFiles = new Set(this.files)

    const sourceDefinitions = (await Promise.all(
      this.files.map(filepath => this.parseTestFile(filepath)),
    )).reduce((acc, data) => {
      if (!data)
        return acc
      acc[data.filepath] = data
      return acc
    }, {} as Record<string, FileInformation>)

    const files: File[] = []

    testFiles.forEach((path) => {
      const { file, definitions, map, parsed } = sourceDefinitions[path]
      const errors = typeErrors.get(path)
      files.push(file)
      if (!errors)
        return files.push(file)
      const sortedDefinitions = [...definitions.sort((a, b) => b.start - a.start)]
      const mapConsumer = map && new SourceMapConsumer(map)
      const indexMap = createIndexMap(parsed)
      errors.forEach(({ error, originalError }, idx) => {
        const originalPos = mapConsumer?.generatedPositionFor({
          line: originalError.line,
          column: originalError.column,
          source: path,
        }) || originalError
        const index = indexMap.get(`${originalPos.line}:${originalPos.column}`)
        const definition = index != null && sortedDefinitions.find(def => def.start <= index && def.end >= index)
        if (!definition)
          return
        definition.task.result = {
          state: 'fail',
        }
        definition.task.tasks.push({
          type: 'typecheck',
          id: idx.toString(),
          name: `error expect ${idx + 1}`,
          mode: 'run',
          file,
          suite: definition.task,
          result: {
            state: 'fail',
            error,
          },
        })
      })
    })

    const sourceErrors: TypeCheckError[] = []

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
        return {
          originalError: info,
          error,
        }
      })
      typesErrors.set(filepath, suiteErrors)
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
