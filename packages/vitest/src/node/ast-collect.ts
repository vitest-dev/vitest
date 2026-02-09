import type { File, Suite, Task, Test } from '@vitest/runner'
import type { Property } from 'estree'
import type { SerializedConfig } from '../runtime/config'
import type { TestError } from '../types/general'
import type { TestProject } from './project'
import { promises as fs } from 'node:fs'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'
import {
  calculateSuiteHash,
  createTaskName,
  generateHash,
  interpretTaskModes,
  someTasksAreOnly,
  validateTags,
} from '@vitest/runner/utils'
import { unique } from '@vitest/utils/helpers'
import { ancestor as walkAst } from 'acorn-walk'
import { relative } from 'pathe'
import { parseAst } from 'vite'
import { createIndexLocationsMap } from '../utils/base'
import { createDebugger } from '../utils/debugger'
import { detectCodeBlock } from '../utils/test-helpers'

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
  tags: string[]
}

const debug = createDebugger('vitest:ast-collect-info')
const verbose = createDebugger('vitest:ast-collect-verbose')

function isTestFunctionName(name: string) {
  return name === 'it' || name === 'test' || name.startsWith('test') || name.endsWith('Test')
}

function isVitestFunctionName(name: string) {
  return name === 'describe' || name === 'suite' || isTestFunctionName(name)
}

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
        && isVitestFunctionName(callee.object.name)
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
      if (!isVitestFunctionName(name)) {
        verbose?.(`Skipping ${name} (unknown call)`)
        return
      }
      const property = callee?.property?.name
      let mode = !property || property === name ? 'run' : property
      // they will be picked up in the next iteration
      if (['each', 'for', 'skipIf', 'runIf', 'extend', 'scoped', 'override'].includes(mode)) {
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

        if (message.endsWith('.name')) {
          message = message.slice(0, -5)
        }
      }

      if (message.startsWith('0,')) {
        message = message.slice(2)
      }

      message = message
        // vite 7+
        .replace(/\(0\s?,\s?__vite_ssr_import_\d+__.(\w+)\)/g, '$1')
        // vite <7
        .replace(/__(vite_ssr_import|vi_import)_\d+__\./g, '')
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

      // Extract tags from the second argument if it's an options object
      const tags: string[] = []
      const secondArg = node.arguments?.[1]
      if (secondArg?.type === 'ObjectExpression') {
        const tagsProperty = secondArg.properties?.find(
          (p: any) => p.type === 'Property' && p.key?.type === 'Identifier' && p.key.name === 'tags',
        ) as Property | undefined
        if (tagsProperty) {
          const tagsValue = tagsProperty.value
          if (tagsValue?.type === 'Literal' && typeof tagsValue.value === 'string') {
            // tags: 'single-tag'
            tags.push(tagsValue.value)
          }
          else if (tagsValue?.type === 'ArrayExpression') {
            // tags: ['tag1', 'tag2']
            for (const element of tagsValue.elements || []) {
              if (element?.type === 'Literal' && typeof element.value === 'string') {
                tags.push(element.value)
              }
            }
          }
        }
      }

      debug?.('Found', name, message, `(${mode})`, tags.length ? `[${tags.join(', ')}]` : '')
      definitions.push({
        start,
        end,
        name: message,
        type: isTestFunctionName(name) ? 'test' : 'suite',
        mode,
        task: null as any,
        dynamic: isDynamicEach,
        tags,
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
    fullName: testFilepath,
    mode: 'run',
    tasks: [],
    start: 0,
    end: 0,
    projectName: project.name,
    meta: {},
    pool: project.browser ? 'browser' : project.config.pool,
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

function createFileTask(
  testFilepath: string,
  code: string,
  requestMap: any,
  config: SerializedConfig,
  filepath: string,
  fileTags: string[] | undefined,
) {
  const { definitions, ast } = astParseFile(testFilepath, code)
  const file: ParsedFile = {
    filepath,
    type: 'suite',
    id: /* @__PURE__ */ generateHash(`${testFilepath}${config.name || ''}`),
    name: testFilepath,
    fullName: testFilepath,
    mode: 'run',
    tasks: [],
    start: ast.start,
    end: ast.end,
    projectName: config.name,
    meta: {},
    pool: 'browser',
    file: null!,
    tags: fileTags || [],
  }
  file.file = file
  const indexMap = createIndexLocationsMap(code)
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
          location = {
            line: originalLocation.line,
            column: originalLocation.column,
          }
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
      // Inherit tags from parent suite and merge with own tags
      const parentTags = latestSuite.tags || []
      const taskTags = unique([...parentTags, ...definition.tags])

      if (definition.type === 'suite') {
        const task: ParsedSuite = {
          type: definition.type,
          id: '',
          suite: latestSuite,
          file,
          tasks: [],
          mode,
          each: definition.dynamic,
          name: definition.name,
          fullName: createTaskName([latestSuite.fullName, definition.name]),
          fullTestName: createTaskName([latestSuite.fullTestName, definition.name]),
          end: definition.end,
          start: definition.start,
          location,
          dynamic: definition.dynamic,
          meta: {},
          tags: taskTags,
        }
        definition.task = task
        latestSuite.tasks.push(task)
        lastSuite = task
        return
      }
      validateTags(config, taskTags)
      const task: ParsedTest = {
        type: definition.type,
        id: '',
        suite: latestSuite,
        file,
        each: definition.dynamic,
        mode,
        context: {} as any, // not used on the server
        name: definition.name,
        fullName: createTaskName([latestSuite.fullName, definition.name]),
        fullTestName: createTaskName([latestSuite.fullTestName, definition.name]),
        end: definition.end,
        start: definition.start,
        location,
        dynamic: definition.dynamic,
        meta: {},
        timeout: 0,
        annotations: [],
        artifacts: [],
        tags: taskTags,
      }
      definition.task = task
      latestSuite.tasks.push(task)
    })
  calculateSuiteHash(file)
  const hasOnly = someTasksAreOnly(file)
  interpretTaskModes(
    file,
    config.testNamePattern,
    undefined,
    undefined,
    undefined,
    hasOnly,
    false,
    config.allowOnly,
  )
  markDynamicTests(file.tasks)
  if (!file.tasks.length) {
    file.result = {
      state: 'fail',
      errors: [
        {
          name: 'Error',
          message: `No test suite found in file ${filepath}`,
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
  return createFileTask(
    testFilepath,
    request.code,
    request.map,
    project.serializedConfig,
    filepath,
    request.fileTags,
  )
}

async function transformSSR(project: TestProject, filepath: string) {
  // Read original file content to extract pragmas (environment, tags)
  const originalCode = await fs.readFile(filepath, 'utf-8').catch(() => '')
  const { env: pragmaEnv, tags: fileTags } = detectCodeBlock(originalCode)

  // Use environment from pragma if defined, otherwise fall back to config
  const environment = pragmaEnv || project.config.environment
  const env = environment === 'jsdom' || environment === 'happy-dom'
    ? project.vite.environments.client
    : project.vite.environments.ssr

  const transformResult = await env.transformRequest(filepath)

  return transformResult ? { ...transformResult, fileTags } : null
}

function markDynamicTests(tasks: Task[]) {
  for (const task of tasks) {
    if (task.dynamic) {
      task.id += '-dynamic'
    }
    if ('tasks' in task) {
      markDynamicTests(task.tasks)
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
