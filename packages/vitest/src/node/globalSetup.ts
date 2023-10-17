import { toArray } from '@vitest/utils'
import type { ViteNodeRunner } from 'vite-node/client'
import type { WorkspaceProject } from './workspace'

export interface GlobalSetupFile {
  file: string
  setup?: () => Promise<Function | void> | void
  teardown?: Function
}

export async function loadGlobalSetupFiles(project: WorkspaceProject): Promise<GlobalSetupFile[]> {
  const globalSetupFiles = [
    ...toArray(project.config.globalSetup),
    ...toArray(project.ctx.config.globalSetup),
  ]
  return Promise.all(globalSetupFiles.map(file => loadGlobalSetupFile(file, project.runner)))
}

async function loadGlobalSetupFile(file: string, runner: ViteNodeRunner): Promise<GlobalSetupFile> {
  const m = await runner.executeFile(file)
  for (const exp of ['default', 'setup', 'teardown']) {
    if (m[exp] != null && typeof m[exp] !== 'function')
      throw new Error(`invalid export in globalSetup file ${file}: ${exp} must be a function`)
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
    throw new Error(`invalid globalSetup file ${file}. Must export setup, teardown or have a default export`)
  }
}
