import { promises as fs } from 'node:fs'
import mm from 'micromatch'
import type {
  ContextTestEnvironment,
  EnvironmentOptions,
  TransformModePatterns,
  VitestEnvironment,
} from '../types'
import type { WorkspaceProject } from '../node/workspace'
import { groupBy } from './base'

export const envsOrder = ['node', 'jsdom', 'happy-dom', 'edge-runtime']

export interface FileByEnv {
  file: string
  env: VitestEnvironment
  envOptions: EnvironmentOptions | null
}

function getTransformMode(
  patterns: TransformModePatterns,
  filename: string,
): 'web' | 'ssr' | undefined {
  if (patterns.web && mm.isMatch(filename, patterns.web)) {
    return 'web'
  }
  if (patterns.ssr && mm.isMatch(filename, patterns.ssr)) {
    return 'ssr'
  }
  return undefined
}

export async function groupFilesByEnv(
  files: (readonly [WorkspaceProject, string])[],
) {
  const filesWithEnv = await Promise.all(
    files.map(async ([project, file]) => {
      const code = await fs.readFile(file, 'utf-8')

      // 1. Check for control comments in the file
      let env = code.match(/@(?:vitest|jest)-environment\s+([\w-]+)\b/)?.[1]
      // 2. Check for globals
      if (!env) {
        for (const [glob, target] of project.config.environmentMatchGlobs
          || []) {
          if (mm.isMatch(file, glob, { cwd: project.config.root })) {
            env = target
            break
          }
        }
      }
      // 3. Fallback to global env
      env ||= project.config.environment || 'node'

      const transformMode = getTransformMode(
        project.config.testTransformMode,
        file,
      )

      const envOptions = JSON.parse(
        code.match(/@(?:vitest|jest)-environment-options\s+?(.+)/)?.[1]
        || 'null',
      )
      const envKey = env === 'happy-dom' ? 'happyDOM' : env
      const environment: ContextTestEnvironment = {
        name: env as VitestEnvironment,
        transformMode,
        options: envOptions
          ? ({ [envKey]: envOptions } as EnvironmentOptions)
          : null,
      }
      return {
        file,
        project,
        environment,
      }
    }),
  )

  return groupBy(filesWithEnv, ({ environment }) => environment.name)
}
