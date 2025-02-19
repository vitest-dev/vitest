import type { File, RunMode, Suite, Test } from '@vitest/runner'
import type { RawSourceMap } from 'vite-node'
import type { TestProject } from '../node/project'
import {
  calculateSuiteHash,
  generateHash,
  interpretTaskModes,
  someTasksAreOnly,
} from '@vitest/runner/utils'
import { ancestor as walkAst } from 'acorn-walk'
import { relative } from 'pathe'
import { parseAstAsync } from 'vite'

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
  mode: RunMode
  task: ParsedSuite | ParsedFile | ParsedTest
}

export interface FileInformation {
  file: File
  filepath: string
  parsed: string
  map: RawSourceMap | null
  definitions: LocalCallDefinition[]
}

export async function collectTests(
  ctx: TestProject,
  filepath: string,
): Promise<null | FileInformation> {
  const request = await ctx.vitenode.transformRequest(filepath, filepath)
  if (!request) {
    return null
  }
  const ast = await parseAstAsync(request.code)
  const testFilepath = relative(ctx.config.root, filepath)
  const projectName = ctx.name
  const typecheckSubprojectName = projectName ? `${projectName}:__typecheck__` : '__typecheck__'
  const file: ParsedFile = {
    filepath,
    type: 'suite',
    id: generateHash(`${testFilepath}${typecheckSubprojectName}`),
    name: testFilepath,
    mode: 'run',
    tasks: [],
    start: ast.start,
    end: ast.end,
    projectName,
    meta: { typecheck: true },
    file: null!,
  }
  file.file = file
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
      // direct call as `__vite_ssr_exports_0__.test()`
      if (callee.object?.name?.startsWith('__vite_ssr_')) {
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
      // .each
      if (callee.type === 'CallExpression') {
        start = callee.end
      }
      else if (callee.type === 'TaggedTemplateExpression') {
        start = callee.end + 1
      }
      else {
        start = node.start
      }

      const {
        arguments: [messageNode],
      } = node

      const isQuoted = messageNode?.type === 'Literal' || messageNode?.type === 'TemplateLiteral'
      const message = isQuoted
        ? request.code.slice(messageNode.start + 1, messageNode.end - 1)
        : request.code.slice(messageNode.start, messageNode.end)

      // cannot statically analyze, so we always skip it
      if (mode === 'skipIf' || mode === 'runIf') {
        mode = 'skip'
      }
      definitions.push({
        start,
        end,
        name: message,
        type: name === 'it' || name === 'test' ? 'test' : 'suite',
        mode,
        task: null as any,
      } satisfies LocalCallDefinition)
    },
  })
  let lastSuite: ParsedSuite = file
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
  interpretTaskModes(
    file,
    ctx.config.testNamePattern,
    undefined,
    hasOnly,
    false,
    ctx.config.allowOnly,
  )
  return {
    file,
    parsed: request.code,
    filepath,
    map: request.map as RawSourceMap | null,
    definitions,
  }
}

function getNodeAsString(node: any, code: string): string {
  if (node.type === 'Literal') {
    return String(node.value)
  }
  else if (node.type === 'Identifier') {
    return node.name
  }
  else if (node.type === 'TemplateLiteral') {
    return mergeTemplateLiteral(node, code)
  }
  else {
    return code.slice(node.start, node.end)
  }
}

function mergeTemplateLiteral(node: any, code: string): string {
  let result = ''
  let expressionsIndex = 0

  for (let quasisIndex = 0; quasisIndex < node.quasis.length; quasisIndex++) {
    result += node.quasis[quasisIndex].value.raw
    if (expressionsIndex in node.expressions) {
      const expression = node.expressions[expressionsIndex]
      const string = expression.type === 'Literal' ? expression.raw : getNodeAsString(expression, code)
      if (expression.type === 'TemplateLiteral') {
        result += `\${\`${string}\`}`
      }
      else {
        result += `\${${string}}`
      }
      expressionsIndex++
    }
  }
  return result
}
