import type { TestSpecification } from '../node/test-specification'
import type { EnvironmentOptions, VitestEnvironment } from '../node/types/config'
import type { ContextTestEnvironment } from '../types/worker'
import { promises as fs } from 'node:fs'

export async function getSpecificationsEnvironments(
  specifications: Array<TestSpecification>,
): Promise<WeakMap<TestSpecification, ContextTestEnvironment>> {
  const environments = new WeakMap<TestSpecification, ContextTestEnvironment>()
  const cache = new Map<string, string>()
  await Promise.all(
    specifications.map(async (spec) => {
      const { moduleId: filepath, project } = spec
      // reuse if projects have the same test files
      let code = cache.get(filepath)
      if (!code) {
        code = await fs.readFile(filepath, 'utf-8')
        cache.set(filepath, code)
      }

      // 1. Check for control comments in the file
      let env = code.match(/@(?:vitest|jest)-environment\s+([\w-]+)\b/)?.[1]
      // 2. Fallback to global env
      env ||= project.config.environment || 'node'

      let envOptionsJson = code.match(/@(?:vitest|jest)-environment-options\s+(.+)/)?.[1]
      if (envOptionsJson?.endsWith('*/')) {
        // Trim closing Docblock characters the above regex might have captured
        envOptionsJson = envOptionsJson.slice(0, -2)
      }

      const envOptions = JSON.parse(envOptionsJson || 'null')
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
  return environments
}
