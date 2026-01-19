import type { TestSpecification } from '../node/test-specification'
import type { EnvironmentOptions, VitestEnvironment } from '../node/types/config'
import type { ContextTestEnvironment } from '../types/worker'
import { promises as fs } from 'node:fs'

export async function getSpecificationsOptions(
  specifications: Array<TestSpecification>,
): Promise<{
  environments: WeakMap<TestSpecification, ContextTestEnvironment>
  tags: WeakMap<TestSpecification, string[]>
}> {
  const environments = new WeakMap<TestSpecification, ContextTestEnvironment>()
  const cache = new Map<string, string>()
  const tags = new WeakMap<TestSpecification, string[]>()
  await Promise.all(
    specifications.map(async (spec) => {
      const { moduleId: filepath, project, pool } = spec
      // browser pool handles its own environment
      if (pool === 'browser') {
        return
      }

      // reuse if projects have the same test files
      let code = cache.get(filepath)
      if (!code) {
        code = await fs.readFile(filepath, 'utf-8').catch(() => '')
        cache.set(filepath, code)
      }

      const {
        env = project.config.environment || 'node',
        envOptions,
        tags: specTags = [],
      } = detectCodeBlock(code)
      tags.set(spec, specTags)

      const envKey = env === 'happy-dom' ? 'happyDOM' : env
      const environment: ContextTestEnvironment = {
        name: env as VitestEnvironment,
        options: envOptions
          ? ({ [envKey]: envOptions } as EnvironmentOptions)
          : null,
      }
      environments.set(spec, environment)
    }),
  )
  return { environments, tags }
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
  // eslint-disable-next-line no-cond-assign
  while (tagMatch = content.match(/(\/\/|\*)\s*@module-tag\s+([\w\-/]+)\b/)) {
    tags.push(tagMatch[2])
    content = content.slice(tagMatch.index! + tagMatch[0].length)
  }
  return { env, envOptions, tags }
}
