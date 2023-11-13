import { relative } from 'pathe'
import { parseAstAsync } from 'vite'
import { ancestor as walkAst } from 'acorn-walk'
import type { RawSourceMap } from 'vite-node'

import { calculateSuiteHash, generateHash, interpretTaskModes, someTasksAreOnly } from '@vitest/runner/utils'
import type { File, Suite, Test } from '../types'
import type { WorkspaceProject } from '../node/workspace'

interface ParsedFile extends File {
  start: number
  end: number
}

interface ParsedTest extends Test {
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
  type: 'suite' | 'test'
  mode: 'run' | 'skip' | 'only' | 'todo'
  task: ParsedSuite | ParsedFile | ParsedTest
}

export interface FileInformation {
  file: File
  filepath: string
  parsed: string
  map: RawSourceMap | null
  definitions: LocalCallDefinition[]
}

export async function collectTests(ctx: WorkspaceProject, filepath: string): Promise<null | FileInformation> {
  const request = await ctx.vitenode.transformRequest(filepath, filepath)
  if (!request)
    return null
  const ast = await parseAstAsync(request.code)
  const testFilepath = relative(ctx.config.root, filepath)
  const file: ParsedFile = {
    filepath,
    type: 'suite',
    id: generateHash(`${testFilepath}${ctx.config.name || ''}`),
    name: testFilepath,
    mode: 'run',
    tasks: [],
    start: ast.start,
    end: ast.end,
    projectName: ctx.getName(),
    meta: { typecheck: true },
  }
  const definitions: LocalCallDefinition[] = []
  const getName = (callee: any): string | null => {
    if (!callee)
      return null
    if (callee.type === 'Identifier')
      return callee.name
    if (callee.type === 'MemberExpression') {
      // direct call as `__vite_ssr_exports_0__.test()`
      if (callee.object?.name?.startsWith('__vite_ssr_'))
        return getName(callee.property)
      // call as `__vite_ssr__.test.skip()`
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
      let mode = (!property || property === name) ? 'run' : property
      if (!['run', 'skip', 'todo', 'only', 'skipIf', 'runIf'].includes(mode))
        throw new Error(`${name}.${mode} syntax is not supported when testing types`)
      // cannot statically analyze, so we always skip it
      if (mode === 'skipIf' || mode === 'runIf')
        mode = 'skip'
      definitions.push({
        start: node.start,
        end: node.end,
        name: message,
        type: (name === 'it' || name === 'test') ? 'test' : 'suite',
        mode,
      } as LocalCallDefinition)
    },
  })
  let lastSuite: ParsedSuite = file
  const updateLatestSuite = (index: number) => {
    const suite = lastSuite
    while (lastSuite !== file && lastSuite.end < index)
      lastSuite = suite.suite as ParsedSuite
    return lastSuite
  }
  definitions.sort((a, b) => a.start - b.start).forEach((definition) => {
    const latestSuite = updateLatestSuite(definition.start)
    let mode = definition.mode
    if (latestSuite.mode !== 'run') // inherit suite mode, if it's set
      mode = latestSuite.mode
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
        projectName: ctx.getName(),
        meta: {
          typecheck: true,
        },
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
      context: {} as any, // not used in typecheck
      name: definition.name,
      end: definition.end,
      start: definition.start,
      meta: {
        typecheck: true,
      },
    }
    definition.task = task
    latestSuite.tasks.push(task)
  })
  calculateSuiteHash(file)
  const hasOnly = someTasksAreOnly(file)
  interpretTaskModes(file, ctx.config.testNamePattern, hasOnly, false, ctx.config.allowOnly)
  return {
    file,
    parsed: request.code,
    filepath,
    map: request.map as RawSourceMap | null,
    definitions,
  }
}
