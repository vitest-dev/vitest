import type { TestModule, Vitest } from 'vitest/node'
import { expect, test } from 'vitest'
import { instances, provider, runInlineBrowserTests } from './utils'

const [{ browser }] = instances
const names = ['first', 'second', 'third']

function countOpenInstances(vitest: Vitest) {
  return vitest.projects.filter((project) => project.browser!.state.orchestrators.size > 0).length
}

function countOpenPages(project: TestModule['project']) {
  return project.browser!.state.orchestrators.size
}

function createFiles(body: string) {
  return Object.fromEntries(
    names.map((name) => [
      `${name}.test.ts`,
      `
      import { test } from 'vitest'
      test('runs in ${name}', async () => {
        ${body}
      })
    `,
    ]),
  )
}

function createInstances() {
  return names.map((name) => ({ browser, name, include: [`${name}.test.ts`] }))
}

test.runIf(provider.name === 'playwright')(
  'runs one browser instance at a time when maxWorkers is 1',
  async () => {
    const events: string[] = []
    const openInstances: number[] = []

    const { stderr, testTree } = await runInlineBrowserTests(
      createFiles('await new Promise(resolve => setTimeout(resolve, 100))'),
      {
        maxWorkers: 1,
        browser: { instances: createInstances() },
        reporters: [
          {
            onTestModuleStart(module: TestModule) {
              events.push(`start ${module.project.name}`)
              openInstances.push(countOpenInstances(module.project.vitest))
            },
            onTestModuleEnd(module: TestModule) {
              events.push(`end ${module.project.name}`)
            },
          },
        ],
      },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "first.test.ts": {
          "runs in first": "passed",
        },
        "second.test.ts": {
          "runs in second": "passed",
        },
        "third.test.ts": {
          "runs in third": "passed",
        },
      }
    `)

    // every instance finishes before the next one opens
    expect(events).toHaveLength(names.length * 2)
    for (let i = 0; i < events.length; i += 2) {
      const name = events[i].replace('start ', '')
      expect(events[i + 1]).toBe(`end ${name}`)
    }
    expect(openInstances).toEqual([1, 1, 1])
  },
)

test.runIf(provider.name === 'playwright')(
  'runs up to maxWorkers browser instances at the same time',
  async () => {
    const openInstances: number[] = []
    const openPages: number[] = []

    const { stderr, testTree } = await runInlineBrowserTests(
      {
        ...createFiles(`
          const { commands } = await import('vitest/browser')
          await vi.waitFor(async () => {
            expect(await commands.openInstances()).toBeGreaterThanOrEqual(2)
          }, { timeout: 10_000 })
        `),
        // the third instance only runs after one of the others is finished
        'third.test.ts': `
          import { test } from 'vitest'
          test('runs in third', () => {})
        `,
      },
      {
        maxWorkers: 2,
        globals: true,
        browser: {
          instances: createInstances(),
          commands: {
            openInstances(context) {
              return countOpenInstances(context.project.vitest)
            },
          },
        },
        reporters: [
          {
            onTestModuleStart(module: TestModule) {
              openInstances.push(countOpenInstances(module.project.vitest))
              openPages.push(countOpenPages(module.project))
            },
          },
        ],
      },
    )

    expect(stderr).toBe('')
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "first.test.ts": {
          "runs in first": "passed",
        },
        "second.test.ts": {
          "runs in second": "passed",
        },
        "third.test.ts": {
          "runs in third": "passed",
        },
      }
    `)
    expect(Math.max(...openInstances)).toBe(2)
    // the running instances split the budget of 2 pages, and the last
    // instance has a single file, so none of them opens a second page
    expect(openPages).toEqual([1, 1, 1])
  },
)

test.runIf(provider.name === 'playwright')(
  'reruns instances that were closed to free a worker slot',
  async () => {
    const files: Record<string, string> = {
      'label.ts': `export const label = 'label'`,
    }
    for (const name of names) {
      files[`${name}.test.ts`] = `
        import { expect, test } from 'vitest'
        import { label } from './label'
        test('reads the label in ${name}', () => {
          expect(label).toBe('label')
        })
      `
    }

    const { fs, vitest } = await runInlineBrowserTests(files, {
      watch: true,
      maxWorkers: 1,
      browser: { instances: createInstances() },
      reporters: ['default'],
    })

    await vitest.waitForStdout(`Test Files  ${names.length} passed`)

    vitest.resetOutput()
    fs.editFile('label.ts', (content) => `${content}\n`)
    await vitest.waitForStdout(`Test Files  ${names.length} passed`)

    expect(vitest.stderr).toBe('')
  },
)
