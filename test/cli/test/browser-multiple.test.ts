import type { Vitest } from 'vitest/node'
import { resolve } from 'pathe'

import { expect, it, onTestFinished, vi } from 'vitest'
import { runVitest } from '../../test-utils'

async function runBrowserProjectsWithInitSpy(options: {
  maxWorkers: number
  project?: string
}) {
  const root = resolve(import.meta.dirname, '../fixtures/browser-multiple')
  let currentlyInitializing = 0
  let maxConcurrentInitializations = 0
  const initializedProjects: string[] = []

  const { stderr } = await runVitest({
    root,
    dir: root,
    watch: false,
    maxWorkers: options.maxWorkers,
    project: options.project,
    reporters: [
      {
        onInit(ctx) {
          for (const project of ctx.projects) {
            project.config.maxWorkers = options.maxWorkers
            const original = project._initBrowserProvider.bind(project)
            project._initBrowserProvider = async () => {
              currentlyInitializing += 1
              maxConcurrentInitializations = Math.max(
                maxConcurrentInitializations,
                currentlyInitializing,
              )
              initializedProjects.push(project.name)
              await new Promise(resolve => setTimeout(resolve, 30))
              try {
                await original()
              }
              finally {
                currentlyInitializing -= 1
              }
            }
          }
        },
      },
    ],
  })

  return {
    stderr,
    initializedProjects,
    maxConcurrentInitializations,
  }
}

it('respects maxWorkers across browser projects during initialization', async () => {
  const { stderr, maxConcurrentInitializations } = await runBrowserProjectsWithInitSpy({
    maxWorkers: 1,
  })

  expect(stderr).toBe('')
  expect(maxConcurrentInitializations).toBe(1)
})

it('allows concurrent browser project initialization when maxWorkers > 1', async () => {
  const { stderr, maxConcurrentInitializations } = await runBrowserProjectsWithInitSpy({
    maxWorkers: 2,
  })

  expect(stderr).toBe('')
  expect(maxConcurrentInitializations).toBeGreaterThan(1)
})

it('initializes only selected browser project when filtered by --project', async () => {
  const { stderr, initializedProjects, maxConcurrentInitializations } = await runBrowserProjectsWithInitSpy({
    maxWorkers: 1,
    project: 'basic-1',
  })

  expect(stderr).toBe('')
  const uniqueProjects = [...new Set(initializedProjects)]
  expect(uniqueProjects).toHaveLength(1)
  expect(uniqueProjects[0]).toContain('basic-1')
  expect(maxConcurrentInitializations).toBe(1)
})

it('automatically assigns the port', async () => {
  const root = resolve(import.meta.dirname, '../fixtures/browser-multiple')
  const spy = vi.spyOn(console, 'log')
  onTestFinished(() => spy.mockRestore())
  let ctx: Vitest
  let urls: (string | undefined)[] = []
  const { stderr } = await runVitest({
    root,
    dir: root,
    watch: false,
    reporters: [
      {
        onInit(ctx_) {
          ctx = ctx_
        },
        onTestRunEnd() {
          urls = ctx.projects.map(p => p.browser?.vite.resolvedUrls?.local[0])
        },
      },
    ],
  })

  expect(spy).not.toHaveBeenCalled()
  expect(stderr).not.toContain('is in use, trying another one...')
  expect(urls).toContain('http://localhost:63315/')
  expect(urls).toContain('http://localhost:63316/')
})
