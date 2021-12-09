import { ResolvedConfig, Task, RunnerContext } from '../types'
import { DefaultReporter } from '../reporters/default'
import { getSnapshotManager } from '../integrations/chai/snapshot'
import { getSuiteTasks } from '../runtime/suite'
import { setupEnv } from './env'

export async function setupRunner(config: ResolvedConfig) {
  await setupEnv(config)

  const ctx: RunnerContext = {
    filesMap: {},
    get files() {
      return Object.values(this.filesMap)
    },
    get tasks() {
      return Object.values(this.filesMap)
        .reduce((tasks, file) => tasks.concat(getSuiteTasks(file)), [] as Task[])
    },
    config,
    reporter: config.reporter || new DefaultReporter(),
    snapshotManager: getSnapshotManager(),
  }

  return ctx
}
