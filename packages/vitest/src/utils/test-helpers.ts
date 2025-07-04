import type { TestProject } from '../node/project'
import type { TestSpecification } from '../node/spec'
import type { EnvironmentOptions, TransformModePatterns, VitestEnvironment } from '../node/types/config'
import type { ContextTestEnvironment } from '../types/worker'
import { promises as fs } from 'node:fs'
import pm from 'picomatch'
import { groupBy } from './base'

export const envsOrder: string[] = ['node', 'jsdom', 'happy-dom', 'edge-runtime']

export interface FileByEnv {
  file: string
  env: VitestEnvironment
  envOptions: EnvironmentOptions | null
}

function getTransformMode(
  patterns: TransformModePatterns,
  filename: string,
): 'web' | 'ssr' | undefined {
  if (patterns.web && pm.isMatch(filename, patterns.web)) {
    return 'web'
  }
  if (patterns.ssr && pm.isMatch(filename, patterns.ssr)) {
    return 'ssr'
  }
  return undefined
}

export async function groupFilesByEnv(
  files: Array<TestSpecification>,
): Promise<Record<string, {
    file: { filepath: string; testLocations: number[] | undefined }
    project: TestProject
    environment: ContextTestEnvironment
  }[]>> {
  const filesWithEnv = await Promise.all(
    files.map(async ({ moduleId: filepath, project, testLines }) => {
      const code = await fs.readFile(filepath, 'utf-8')

      // 1. Check for control comments in the file
      let env = code.match(/@(?:vitest|jest)-environment\s+([\w-]+)\b/)?.[1]
      // 2. Fallback to global env
      env ||= project.config.environment || 'node'

      const transformMode = getTransformMode(
        project.config.testTransformMode,
        filepath,
      )

      let envOptionsJson = code.match(/@(?:vitest|jest)-environment-options\s+(.+)/)?.[1]
      if (envOptionsJson?.endsWith('*/')) {
        // Trim closing Docblock characters the above regex might have captured
        envOptionsJson = envOptionsJson.slice(0, -2)
      }

      const envOptions = JSON.parse(envOptionsJson || 'null')
      const envKey = env === 'happy-dom' ? 'happyDOM' : env
      const environment: ContextTestEnvironment = {
        name: env as VitestEnvironment,
        transformMode,
        options: envOptions
          ? ({ [envKey]: envOptions } as EnvironmentOptions)
          : null,
      }
      return {
        file: {
          filepath,
          testLocations: testLines,
        },
        project,
        environment,
      }
    }),
  )

  return groupBy(filesWithEnv, ({ environment }) => environment.name)
}
