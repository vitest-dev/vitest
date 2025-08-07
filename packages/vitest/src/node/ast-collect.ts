import type { File, Suite, TaskBase, Test } from '@vitest/runner'
import type { SourceMap } from 'node:module'
import type { TestError } from '../types/general'
import type { TestProject } from './project'
import {
  calculateSuiteHash,
  generateHash,
  interpretTaskModes,
  someTasksAreOnly,
} from '@vitest/runner/utils'
import { originalPositionFor, TraceMap } from '@vitest/utils/source-map'
import { ancestor as walkAst } from 'acorn-walk'
import { relative } from 'pathe'
import { parseAst } from 'vite'
import { createDebugger } from '../utils/debugger'

interface ParsedFile extends File {
  start: number
  end: number
}

interface ParsedTest extends Test {
  start: number
  end: number
  dynamic: boolean
}

interface ParsedSuite extends Suite {
  start: number
  end: number
  dynamic: boolean
}

interface LocalCallDefinition {
  start: number
  end: number
  name: string
  type: 'suite' | 'test'
  mode: 'run' | 'skip' | 'only' | 'todo' | 'queued'
  task: ParsedSuite | ParsedFile | ParsedTest
  dynamic: boolean
}

export interface FileInformation {
  file: File
  filepath: string
  parsed: string | null
  map: SourceMap | { mappings: string } | null
  definitions: LocalCallDefinition[]
}

const debug = createDebugger('vitest:ast-collect-info')
const verbose = createDebugger('vitest:ast-collect-verbose')

function astParseFile(filepath: string, code: string) {
  const ast = parseAst(code)

  if (verbose) {
    verbose(
      'Collecting',
      filepath,
      code,
    )
  }
  else {
    debug?.('Collecting', filepath)
  }
  const definitions: LocalCallDefinition[] = []
  const getName = (callee: any): string | null => {
    if (!callee) {
      return null
    }
    if (callee.type === 'Identifier') {
      return callee.name
    }
    if (callee.type === 'CallExpression') {
      return getName(callee.callee)
    }
    if (callee.type === 'TaggedTemplateExpression') {
      return getName(callee.tag)
    }
    if (callee.type === 'MemberExpression') {
      if (
        callee.object?.type === 'Identifier'
        && ['it', 'test', 'describe', 'suite'].includes(callee.object.name)
      ) {
        return callee.object?.name
      }
      if (
        // direct call as `__vite_ssr_exports_0__.test()`
        callee.object?.name?.startsWith('__vite_ssr_')
        // call as `__vite_ssr_exports_0__.Vitest.test`,
        // this is a special case for using Vitest namespaces popular in Effect
        || (callee.object?.object?.name?.startsWith('__vite_ssr_') && callee.object?.property?.name === 'Vitest')
      ) {
        return getName(callee.property)
      }
      // call as `__vite_ssr__.test.skip()`
      return getName(callee.object?.property)
    }
    // unwrap (0, ...)
    if (callee.type === 'SequenceExpression' && callee.expressions.length === 2) {
      const [e0, e1] = callee.expressions
      if (e0.type === 'Literal' && e0.value === 0) {
        return getName(e1)
      }
    }
    return null
  }

  walkAst(ast as any, {
    CallExpression(node) {
      const { callee } = node as any
      const name = getName(callee)
      if (!name) {
        return
      }
      if (!['it', 'test', 'describe', 'suite'].includes(name)) {
        verbose?.(`Skipping ${name} (unknown call)`)
        return
      }
      const property = callee?.property?.name
      let mode = !property || property === name ? 'run' : property
      // they will be picked up in the next iteration
      if (['each', 'for', 'skipIf', 'runIf'].includes(mode)) {
        return
      }

      let start: number
      const end = node.end
      // .each or (0, __vite_ssr_exports_0__.test)()
      if (
        callee.type === 'CallExpression'
        || callee.type === 'SequenceExpression'
        || callee.type === 'TaggedTemplateExpression'
      ) {
        start = callee.end
      }
      else {
        start = node.start
      }

      const messageNode = node.arguments?.[0]

      if (messageNode == null) {
        verbose?.(`Skipping node at ${node.start} because it doesn't have a name`)
        return
      }

      let message: string
      if (messageNode?.type === 'Literal' || messageNode?.type === 'TemplateLiteral') {
        message = code.slice(messageNode.start + 1, messageNode.end - 1)
      }
      else {
        message = code.slice(messageNode.start, messageNode.end)
      }

      if (message.startsWith('0,')) {
        message = message.slice(2)
      }

      message = message
        // Vite SSR injects these
        .replace(/__vite_ssr_import_\d+__\./g, '')
        // Vitest module mocker injects these
        .replace(/__vi_import_\d+__\./g, '')

      // cannot statically analyze, so we always skip it
      if (mode === 'skipIf' || mode === 'runIf') {
        mode = 'skip'
      }

      const parentCalleeName = typeof callee?.callee === 'object' && callee?.callee.type === 'MemberExpression' && callee?.callee.property?.name
      let isDynamicEach = parentCalleeName === 'each' || parentCalleeName === 'for'
      if (!isDynamicEach && callee.type === 'TaggedTemplateExpression') {
        const property = callee.tag?.property?.name
        isDynamicEach = property === 'each' || property === 'for'
      }

      debug?.('Found', name, message, `(${mode})`)
      definitions.push({
        start,
        end,
        name: message,
        type: name === 'it' || name === 'test' ? 'test' : 'suite',
        mode,
        task: null as any,
        dynamic: isDynamicEach,
      } satisfies LocalCallDefinition)
    },
  })
  return {
    ast,
    definitions,
  }
}

export function createFailedFileTask(project: TestProject, filepath: string, error: Error): File {
  const testFilepath = relative(project.config.root, filepath)
  const file: ParsedFile = {
    filepath,
    type: 'suite',
    id: /* @__PURE__ */ generateHash(`${testFilepath}${project.config.name || ''}`),
    name: testFilepath,
    mode: 'run',
    tasks: [],
    start: 0,
    end: 0,
    projectName: project.getName(),
    meta: {},
    pool: 'browser',
    file: null!,
    result: {
      state: 'fail',
      errors: serializeError(project, error),
    },
  }
  file.file = file
  return file
}

function serializeError(ctx: TestProject, error: any): TestError[] {
  if ('errors' in error && 'pluginCode' in error) {
    const errors = error.errors.map((e: any) => {
      return {
        name: error.name,
        message: e.text,
        stack: e.location
          ? `${error.name}: ${e.text}\n  at ${relative(ctx.config.root, e.location.file)}:${e.location.line}:${e.location.column}`
          : '',
      }
    })
    return errors
  }
  return [
    {
      name: error.name,
      stack: error.stack,
      message: error.message,
    },
  ]
}

interface ParseOptions {
  name: string
  filepath: string
  allowOnly: boolean
  testNamePattern?: RegExp | undefined
}

function createFileTask(
  testFilepath: string,
  code: string,
  requestMap: any,
  options: ParseOptions,
) {
  const { definitions, ast } = astParseFile(testFilepath, code)
  const file: ParsedFile = {
    filepath: options.filepath,
    type: 'suite',
    id: /* @__PURE__ */ generateHash(`${testFilepath}${options.name || ''}`),
    name: testFilepath,
    mode: 'run',
    tasks: [],
    start: ast.start,
    end: ast.end,
    projectName: options.name,
    meta: {},
    pool: 'browser',
    file: null!,
  }
  file.file = file
  const indexMap = createIndexMap(code)
  const map = requestMap && new TraceMap(requestMap)
  let lastSuite: ParsedSuite = file as any
  const updateLatestSuite = (index: number) => {
    while (lastSuite.suite && lastSuite.end < index) {
      lastSuite = lastSuite.suite as ParsedSuite
    }
    return lastSuite
  }
  definitions
    .sort((a, b) => a.start - b.start)
    .forEach((definition) => {
      const latestSuite = updateLatestSuite(definition.start)
      let mode = definition.mode
      if (latestSuite.mode !== 'run') {
        // inherit suite mode, if it's set
        mode = latestSuite.mode
      }
      const processedLocation = indexMap.get(definition.start)
      let location: { line: number; column: number } | undefined
      if (map && processedLocation) {
        const originalLocation = originalPositionFor(map, {
          line: processedLocation.line,
          column: processedLocation.column,
        })
        if (originalLocation.column != null) {
          verbose?.(
            `Found location for`,
            definition.type,
            definition.name,
            `${processedLocation.line}:${processedLocation.column}`,
            '->',
            `${originalLocation.line}:${originalLocation.column}`,
          )
          location = originalLocation
        }
        else {
          debug?.(
            'Cannot find original location for',
            definition.type,
            definition.name,
            `${processedLocation.column}:${processedLocation.line}`,
          )
        }
      }
      else {
        debug?.(
          'Cannot find original location for',
          definition.type,
          definition.name,
          `${definition.start}`,
        )
      }
      if (definition.type === 'suite') {
        const task: ParsedSuite = {
          type: definition.type,
          id: '',
          suite: latestSuite,
          file,
          tasks: [],
          mode,
          name: definition.name,
          end: definition.end,
          start: definition.start,
          location,
          dynamic: definition.dynamic,
          meta: {},
        }
        definition.task = task
        latestSuite.tasks.push(task)
        lastSuite = task
        return
      }
      const task: ParsedTest = {
        type: definition.type,
        id: '',
        suite: latestSuite,
        file,
        mode,
        context: {} as any, // not used on the server
        name: definition.name,
        end: definition.end,
        start: definition.start,
        location,
        dynamic: definition.dynamic,
        meta: {},
        timeout: 0,
        annotations: [],
      }
      definition.task = task
      latestSuite.tasks.push(task)
    })
  calculateSuiteHash(file)
  const hasOnly = someTasksAreOnly(file)
  interpretTaskModes(
    file,
    options.testNamePattern,
    undefined,
    hasOnly,
    false,
    options.allowOnly,
  )
  markDynamicTests(file.tasks)
  if (!file.tasks.length) {
    file.result = {
      state: 'fail',
      errors: [
        {
          name: 'Error',
          message: `No test suite found in file ${options.filepath}`,
        },
      ],
    }
  }
  return file
}

export async function astCollectTests(
  project: TestProject,
  filepath: string,
): Promise<File> {
  const request = await transformSSR(project, filepath)
  const testFilepath = relative(project.config.root, filepath)
  if (!request) {
    debug?.('Cannot parse', testFilepath, '(vite didn\'t return anything)')
    return createFailedFileTask(
      project,
      filepath,
      new Error(`Failed to parse ${testFilepath}. Vite didn't return anything.`),
    )
  }
  return createFileTask(testFilepath, request.code, request.map, {
    name: project.config.name,
    filepath,
    allowOnly: project.config.allowOnly,
    testNamePattern: project.config.testNamePattern,
  })
}

async function transformSSR(project: TestProject, filepath: string) {
  const request = await project.vite.transformRequest(filepath, { ssr: false })
  if (!request) {
    return null
  }
  return await project.vite.ssrTransform(request.code, request.map, filepath)
}

function createIndexMap(source: string) {
  const map = new Map<number, { line: number; column: number }>()
  let index = 0
  let line = 1
  let column = 1
  for (const char of source) {
    map.set(index++, { line, column })
    if (char === '\n' || char === '\r\n') {
      line++
      column = 0
    }
    else {
      column++
    }
  }
  return map
}

function markDynamicTests(tasks: TaskBase[]) {
  for (const task of tasks) {
    if ((task as any).dynamic) {
      task.id += '-dynamic'
    }
    if ('tasks' in task) {
      markDynamicTests(task.tasks as TaskBase[])
    }
  }
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const kReplacers = new Map<string, string>([
  ['%i', '\\d+?'],
  ['%#', '\\d+?'],
  ['%d', '[\\d.eE+-]+?'],
  ['%f', '[\\d.eE+-]+?'],
  ['%s', '.+?'],
  ['%j', '.+?'],
  ['%o', '.+?'],
  ['%%', '%'],
])

export function escapeTestName(label: string, dynamic: boolean): string {
  if (!dynamic) {
    return escapeRegex(label)
  }

  // Replace object access patterns ($value, $obj.a) with %s first
  let pattern = label.replace(/\$[a-z_.]+/gi, '%s')
  pattern = escapeRegex(pattern)
  // Replace percent placeholders with their respective regex
  pattern = pattern.replace(/%[i#dfsjo%]/g, m => kReplacers.get(m) || m)
  return pattern
}
