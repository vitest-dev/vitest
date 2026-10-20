import type { TestModule } from 'vitest/node'
import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

test('prepareDuration does not include the time of previous files', async () => {
  const testFile = `
    import { test } from 'vitest'
    test('waits', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    })
  `
  const modulesByProject = new Map<string, TestModule[]>()

  const { stderr } = await runInlineBrowserTests(
    {
      'first.test.ts': testFile,
      'second.test.ts': testFile,
    },
    {
      reporters: [
        {
          onTestModuleEnd(module) {
            const modules = modulesByProject.get(module.project.name) ?? []
            modules.push(module)
            modulesByProject.set(module.project.name, modules)
          },
        },
      ],
    },
  )

  expect(stderr).toBe('')
  expect(modulesByProject.size).toBe(instances.length)

  for (const [project, modules] of modulesByProject) {
    expect.soft(modules, project).toHaveLength(2)
    const [previous, next] = modules.map((module) => module.diagnostic())

    expect.soft(previous.prepareDuration, project).toBeGreaterThan(0)
    expect.soft(next.prepareDuration, project).toBeGreaterThan(0)
    expect.soft(next.prepareDuration, project).toBeLessThan(previous.duration)
  }
})
