import type { ViteNodeRunner } from 'vite-node/client'
import type { TestProject } from './project'
import { toArray } from '@vitest/utils'

/** @deprecated use `TestProject` instead */
export type GlobalSetupContext = TestProject

export interface GlobalSetupFile {
  file: string
  setup?: (context: TestProject) => Promise<Function | void> | void
  teardown?: Function
}

export async function loadGlobalSetupFiles(
  runner: ViteNodeRunner,
  globalSetup: string | string[],
): Promise<GlobalSetupFile[]> {
  const globalSetupFiles = toArray(globalSetup)
  return Promise.all(
    globalSetupFiles.map(file => loadGlobalSetupFile(file, runner)),
  )
}

async function loadGlobalSetupFile(
  file: string,
  runner: ViteNodeRunner,
): Promise<GlobalSetupFile> {
  const m = await runner.executeFile(file)
  for (const exp of ['default', 'setup', 'teardown']) {
    if (m[exp] != null && typeof m[exp] !== 'function') {
      throw new Error(
        `invalid export in globalSetup file ${file}: ${exp} must be a function`,
      )
    }
  }
  if (m.default) {
    return {
      file,
      setup: m.default,
    }
  }
  else if (m.setup || m.teardown) {
    return {
      file,
      setup: m.setup,
      teardown: m.teardown,
    }
  }
  else {
    throw new Error(
      `invalid globalSetup file ${file}. Must export setup, teardown or have a default export`,
    )
  }
}
