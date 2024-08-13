import { readFileSync } from 'node:fs'
import { relative } from 'pathe'
import { parseAstAsync } from 'vite'
import { ancestor as walkAst } from 'acorn-walk'
import type { RawSourceMap } from 'vite-node'
import {
  calculateSuiteHash,
  generateHash,
  interpretTaskModes,
  someTasksAreOnly,
} from '@vitest/runner/utils'
import type { File, Suite, Test } from '@vitest/runner'
import type { WorkspaceProject } from '../node/workspace'
import { generateCodeFrame } from '../node/error'

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

export async function collectTests(
  ctx: WorkspaceProject,
  filepath: string,
): Promise<null | FileInformation> {
  const request = await ctx.vitenode.transformRequest(filepath, filepath)
  if (!request) {
    return null
  }
  const vitest = ctx.ctx
  const ast = await parseAstAsync(request.code)
  const testFilepath = relative(ctx.config.root, filepath)
  const projectName = ctx.getName()
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
      // direct call as `__vite_ssr_exports_0__.test()`
      if (callee.object?.name?.startsWith('__vite_ssr_')) {
        return getName(callee.property)
      }
      // call as `__vite_ssr__.test.skip()`
      return getName(callee.object?.property)
    }
    return null
  }

  const nodeFrames = new WeakSet<Node>()

  function getCodeFrame(node: any, start?: number) {
    if (nodeFrames.has(node)) {
      return '' // don't duplicate the node
    }
    const higlight = vitest.logger.highlight(filepath, readFileSync(filepath, 'utf8'))
    const codeframe = generateCodeFrame(
      higlight,
      4,
      start ?? (node.start + 1),
    )
    nodeFrames.add(node)
    return codeframe
  }

  function warn(message: string, node: any, start?: number) {
    if (ctx.config.typecheck.ignoreCollectWarnings) {
      return
    }
    const codeframe = getCodeFrame(
      node,
      start ?? (node.start + 1),
    )
    if (codeframe) {
      message += `:\n${codeframe}`
    }
    vitest.logger.warn(
      `${message}\nIf you want so suppress these messages, set \`typecheck.ignoreCollectWarnings: true\` in your config.`,
    )
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
      if (mode === 'each') {
        warn(`Type checker doesn't support ${name}.each`, node)
        return
      }

      let start: number
      const end = node.end

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
      let message: string = 'unknown'

      if (messageNode.type === 'Literal') {
        message = String(messageNode.value)
      }
      else if (messageNode.type === 'Identifier') {
        message = messageNode.name
      }
      else if (messageNode.type === 'TemplateLiteral') {
        message = mergeTemplateLiteral(messageNode as any)
      }
      else {
        message = 'unknown'
        warn(`Type checker cannot statically analyze the message of ${name}, fallback to "unknown"`, node, start)
      }

      // cannot statically analyze, so we always skip it
      if (mode === 'skipIf' || mode === 'runIf') {
        mode = 'skip'
        warn(`Type checker cannot statically analyze the mode of ${name}.${mode}, fallback to "skip"`, node, start)
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

function mergeTemplateLiteral(node: any): string {
  let result = ''
  let expressionsIndex = 0

  for (let quasisIndex = 0; quasisIndex < node.quasis.length; quasisIndex++) {
    result += node.quasis[quasisIndex].value.raw
    if (expressionsIndex in node.expressions) {
      result += `{${node.expressions[expressionsIndex]}}`
      expressionsIndex++
    }
  }
  return result
}
