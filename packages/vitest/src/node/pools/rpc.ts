import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'pathe'
import type { RuntimeRPC } from '../../types'
import type { WorkspaceProject } from '../workspace'

const created = new Set()
const promises = new Map<string, Promise<void>>()

export function createMethodsRPC(project: WorkspaceProject): RuntimeRPC {
  const ctx = project.ctx
  return {
    snapshotSaved(snapshot) {
      ctx.snapshot.add(snapshot)
    },
    resolveSnapshotPath(testPath: string) {
      return ctx.snapshot.resolvePath(testPath)
    },
    async fetch(id, envName) {
      const environment = await project.ensureEnvironment(envName)
      const result = await environment.processModule(id)
      const code = result.code
      if (result.externalize)
        return result
      if ('id' in result && typeof result.id === 'string')
        return { id: result.id as string }

      if (code == null)
        throw new Error(`Failed to fetch module ${id}`)

      const dir = join(project.tmpDir, environment.name)
      const name = createHash('sha1').update(id).digest('hex')
      const tmp = join(dir, name)
      if (promises.has(tmp)) {
        await promises.get(tmp)
        return { id: tmp }
      }
      if (!created.has(dir)) {
        await mkdir(dir, { recursive: true })
        created.add(dir)
      }
      promises.set(tmp, writeFile(tmp, code, 'utf-8').finally(() => promises.delete(tmp)))
      await promises.get(tmp)
      Object.assign(result, { id: tmp })
      return { id: tmp }
    },
    async resolveId(id, importer, envName) {
      const environment = await project.ensureEnvironment(envName)
      return environment.resolveId(id, importer)
    },
    // TODO: store the result on the FS like in "fetch"
    async transform(id, envName) {
      const environment = await project.ensureEnvironment(envName)
      const result = await environment.transformModule(id)
      if (result?.code == null)
        throw new Error(`Failed to fetch module ${id}`)
      return { code: result.code }
    },
    onPathsCollected(paths) {
      ctx.state.collectPaths(paths)
      return ctx.report('onPathsCollected', paths)
    },
    onCollected(files) {
      ctx.state.collectFiles(files)
      return ctx.report('onCollected', files)
    },
    onAfterSuiteRun(meta) {
      ctx.coverageProvider?.onAfterSuiteRun(meta)
    },
    onTaskUpdate(packs) {
      ctx.state.updateTasks(packs)
      return ctx.report('onTaskUpdate', packs)
    },
    onUserConsoleLog(log) {
      ctx.state.updateUserLog(log)
      ctx.report('onUserConsoleLog', log)
    },
    onUnhandledError(err, type) {
      ctx.state.catchError(err, type)
    },
    onFinished(files) {
      return ctx.report('onFinished', files, ctx.state.getUnhandledErrors())
    },
    onCancel(reason) {
      ctx.cancelCurrentRun(reason)
    },
    getCountOfFailedTests() {
      return ctx.state.getCountOfFailedTests()
    },
  }
}
