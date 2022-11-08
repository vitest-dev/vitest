import { relative } from 'pathe'
import { parse as parseAst } from 'acorn'
import { ancestor as walkAst } from 'acorn-walk'
import type { RawSourceMap } from 'vite-node'

import type { File, Suite, Vitest } from '../types'
import { interpretTaskModes, someTasksAreOnly } from '../utils/collect'
import { TYPECHECK_SUITE } from './constants'

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

export interface FileInformation {
  file: File
  filepath: string
  parsed: string
  map: RawSourceMap | null
  definitions: LocalCallDefinition[]
}

export async function collectTests(ctx: Vitest, filepath: string): Promise<null | FileInformation> {
  const request = await ctx.vitenode.transformRequest(filepath)
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
    name: relative(ctx.config.root, filepath),
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
      const mode = !property || property === name ? 'run' : property
      if (!['run', 'skip', 'todo', 'only'].includes(mode))
        throw new Error(`${name}.${mode} syntax is not supported when testing types`)
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
  const updateLatestSuite = (index: number) => {
    const suite = lastSuite
    while (lastSuite !== file && lastSuite.end < index)
      lastSuite = suite.suite as ParsedSuite
    return lastSuite
  }
  definitions.sort((a, b) => a.start - b.start).forEach((definition, idx) => {
    const latestSuite = updateLatestSuite(definition.start)
    let mode = definition.mode
    if (latestSuite.mode !== 'run') // inherit suite mode, if it's set
      mode = latestSuite.mode
    const state = mode === 'run' ? 'pass' : mode
    // expectTypeOf and any type error is actually a "test" ("typecheck"),
    // and all "test"s should be inside a "suite", so semantics inside typecheck for "test" changes
    // if we ever allow having multiple errors in a test, we can change type to "test"
    const task: ParsedSuite = {
      type: 'suite',
      id: idx.toString(),
      suite: latestSuite,
      file,
      tasks: [],
      mode,
      name: definition.name,
      end: definition.end,
      start: definition.start,
      result: {
        state,
      },
    }
    definition.task = task
    latestSuite.tasks.push(task)
    if (definition.type === 'describe' || definition.type === 'suite')
      lastSuite = task
    else
      // to show correct amount of "tests" in summary, we mark this with a special symbol
      Object.defineProperty(task, TYPECHECK_SUITE, { value: true })
  })
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
