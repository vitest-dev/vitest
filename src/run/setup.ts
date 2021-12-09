import { setupChai } from '../integrations/chai/setup'
import { ResolvedConfig, Task, RunnerContext } from '../types'
import { DefaultReporter } from '../reporters/default'
import { getSnapshotManager } from '../integrations/chai/snapshot'
import { getSuiteTasks } from '../suite'

export async function setupRunner(config: ResolvedConfig) {
  // setup chai
  await setupChai(config)

  if (config.global)
    (await import('../integrations/global')).registerApiGlobally()
  if (config.dom === 'happy-dom')
    (await import('../integrations/dom/happy-dom')).setupHappyDOM(globalThis)
  else if (config.dom)
    (await import('../integrations/dom/jsdom')).setupJSDOM(globalThis)

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
