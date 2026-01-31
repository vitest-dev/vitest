import type { FileSpecification, VitestRunner } from './types/runner'
import type { File, SuiteHooks } from './types/tasks'
import { processError } from '@vitest/utils/error' // TODO: load dynamically
import { toArray } from '@vitest/utils/helpers'
import { collectorContext } from './context'
import { getHooks, setHooks } from './map'
import { runSetupFiles } from './setup'
import {
  clearCollectorContext,
  createSuiteHooks,
  getDefaultSuite,
} from './suite'
import {
  calculateSuiteHash,
  createFileTask,
  interpretTaskModes,
  someTasksAreOnly,
} from './utils/collect'
import { createTagsFilter, validateTags } from './utils/tags'

const now = globalThis.performance ? globalThis.performance.now.bind(globalThis.performance) : Date.now

export async function collectTests(
  specs: string[] | FileSpecification[],
  runner: VitestRunner,
): Promise<File[]> {
  const files: File[] = []

  const config = runner.config
  const $ = runner.trace!
  let defaultTagsFilter: ((testTags: string[]) => boolean) | undefined

  for (const spec of specs) {
    const filepath = typeof spec === 'string' ? spec : spec.filepath
    await $(
      'collect_spec',
      { 'code.file.path': filepath },
      async () => {
        const testLocations = typeof spec === 'string' ? undefined : spec.testLocations
        const testNamePattern = typeof spec === 'string' ? undefined : spec.testNamePattern
        const testIds = typeof spec === 'string' ? undefined : spec.testIds
        const testTagsFilter = typeof spec === 'object' && spec.testTagsFilter
          ? createTagsFilter(spec.testTagsFilter, config.tags)
          : undefined

        const fileTags: string[] = typeof spec === 'string' ? [] : (spec.fileTags || [])

        const file = createFileTask(filepath, config.root, config.name, runner.pool, runner.viteEnvironment)
        file.tags = fileTags
        file.shuffle = config.sequence.shuffle

        try {
          validateTags(runner.config, fileTags)

          runner.onCollectStart?.(file)

          clearCollectorContext(file, runner)

          const setupFiles = toArray(config.setupFiles)
          if (setupFiles.length) {
            const setupStart = now()
            await runSetupFiles(config, setupFiles, runner)
            const setupEnd = now()
            file.setupDuration = setupEnd - setupStart
          }
          else {
            file.setupDuration = 0
          }

          const collectStart = now()

          await runner.importFile(filepath, 'collect')

          const durations = runner.getImportDurations?.()
          if (durations) {
            file.importDurations = durations
          }

          const defaultTasks = await getDefaultSuite().collect(file)

          const fileHooks = createSuiteHooks()
          mergeHooks(fileHooks, getHooks(defaultTasks))

          for (const c of [...defaultTasks.tasks, ...collectorContext.tasks]) {
            if (c.type === 'test' || c.type === 'suite') {
              file.tasks.push(c)
            }
            else if (c.type === 'collector') {
              const suite = await c.collect(file)
              if (suite.name || suite.tasks.length) {
                mergeHooks(fileHooks, getHooks(suite))
                file.tasks.push(suite)
              }
            }
            else {
              // check that types are exhausted
              c satisfies never
            }
          }

          setHooks(file, fileHooks)
          file.collectDuration = now() - collectStart
        }
        catch (e) {
          const errors = e instanceof AggregateError
            ? e.errors.map(e => processError(e, runner.config.diffOptions))
            : [processError(e, runner.config.diffOptions)]
          file.result = {
            state: 'fail',
            errors,
          }

          const durations = runner.getImportDurations?.()
          if (durations) {
            file.importDurations = durations
          }
        }

        calculateSuiteHash(file)

        const hasOnlyTasks = someTasksAreOnly(file)
        if (!testTagsFilter && !defaultTagsFilter && config.tagsFilter) {
          defaultTagsFilter = createTagsFilter(config.tagsFilter, config.tags)
        }
        interpretTaskModes(
          file,
          testNamePattern ?? config.testNamePattern,
          testLocations,
          testIds,
          testTagsFilter ?? defaultTagsFilter,
          hasOnlyTasks,
          false,
          config.allowOnly,
        )

        if (file.mode === 'queued') {
          file.mode = 'run'
        }

        files.push(file)
      },
    )
  }

  return files
}

function mergeHooks(baseHooks: SuiteHooks, hooks: SuiteHooks): SuiteHooks {
  for (const _key in hooks) {
    const key = _key as keyof SuiteHooks
    baseHooks[key].push(...(hooks[key] as any))
  }

  return baseHooks
}
