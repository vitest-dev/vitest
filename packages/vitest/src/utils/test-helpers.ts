import type { FileSpecification } from '@vitest/runner'
import type { TestProject } from '../node/project'
import type { TestSpecification } from '../node/spec'
import type { EnvironmentOptions, VitestEnvironment } from '../node/types/config'
import type { ContextTestEnvironment } from '../types/worker'
import { promises as fs } from 'node:fs'
import { groupBy } from './base'

export const envsOrder: string[] = ['node', 'jsdom', 'happy-dom', 'edge-runtime']

export interface FileByEnv {
  file: string
  env: VitestEnvironment
  envOptions: EnvironmentOptions | null
}

export async function groupFilesByEnv(
  files: Array<TestSpecification>,
): Promise<Record<string, {
  file: FileSpecification
  project: TestProject
  environment: ContextTestEnvironment
}[]>> {
  const filesWithEnv = await Promise.all(
    files.map(async ({ moduleId: filepath, project, testLines, testNamePattern }) => {
      const code = await fs.readFile(filepath, 'utf-8')

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
      return {
        file: {
          filepath,
          testLocations: testLines,
          testNamePattern,
        },
        project,
        environment,
      }
    }),
  )

  return groupBy(filesWithEnv, ({ environment }) => environment.name)
}
