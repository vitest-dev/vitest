import type { SpecificationDocblock, TestSpecification } from '../node/test-specification'
import type { EnvironmentOptions, VitestEnvironment } from '../node/types/config'
import type { ContextTestEnvironment } from '../types/worker'
import { promises as fs } from 'node:fs'

export async function getSpecificationsOptions(specifications: Array<TestSpecification>): Promise<{
  environments: WeakMap<TestSpecification, ContextTestEnvironment>
  tags: WeakMap<TestSpecification, string[]>
}> {
  const environments = new WeakMap<TestSpecification, ContextTestEnvironment>()
  const tags = new WeakMap<TestSpecification, string[]>()
  // reuse if projects have the same test files
  const files = new Map<string, Promise<string>>()
  await Promise.all(
    specifications.map(async (spec) => {
      // browser pool handles its own environment
      if (spec.pool === 'browser') {
        return
      }
      const docblock = await getSpecificationDocblock(spec, files)
      tags.set(spec, docblock.tags)
      environments.set(spec, docblock.environment)
    }),
  )
  return { environments, tags }
}

export async function getSpecificationDocblock(
  spec: TestSpecification,
  files?: Map<string, Promise<string>>,
): Promise<SpecificationDocblock> {
  if (spec._docblock) {
    return spec._docblock
  }

  const filepath = spec.moduleId
  let code = files?.get(filepath)
  if (!code) {
    code = fs.readFile(filepath, 'utf-8').catch(() => '')
    files?.set(filepath, code)
  }

  const {
    env = spec.project.config.environment || 'node',
    envOptions,
    tags = [],
  } = detectCodeBlock(await code)

  const envKey = env === 'happy-dom' ? 'happyDOM' : env
  spec._docblock = {
    environment: {
      name: env as VitestEnvironment,
      options: envOptions ? ({ [envKey]: envOptions } as EnvironmentOptions) : null,
    },
    tags,
  }
  return spec._docblock
}

export function detectCodeBlock(content: string): {
  env?: string
  envOptions?: Record<string, any>
  tags: string[]
} {
  const env = content.match(/@(?:vitest|jest)-environment\s+([\w-]+)\b/)?.[1]
  let envOptionsJson = content.match(/@(?:vitest|jest)-environment-options\s+(.+)/)?.[1]
  if (envOptionsJson?.endsWith('*/')) {
    // Trim closing Docblock characters the above regex might have captured
    envOptionsJson = envOptionsJson.slice(0, -2)
  }
  const envOptions = JSON.parse(envOptionsJson || 'null')
  const tags: string[] = []
  let tagMatch: RegExpMatchArray | null
  // oxlint-disable-next-line no-cond-assign
  while ((tagMatch = content.match(/(\/\/|\*)\s*@module-tag\s+([\w\-/]+)\b/))) {
    tags.push(tagMatch[2])
    content = content.slice(tagMatch.index! + tagMatch[0].length)
  }
  return { env, envOptions, tags }
}
