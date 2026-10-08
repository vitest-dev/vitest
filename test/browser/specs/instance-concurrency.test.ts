import type { TestModule, Vitest } from 'vitest/node'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { playwright } from '@vitest/browser-playwright'
import { join } from 'pathe'
import { expect, onTestFinished, test } from 'vitest'
import { instances, provider, runInlineBrowserTests } from './utils'

const [{ browser }] = instances
const names = ['first', 'second', 'third']

function countOpenInstances(vitest: Vitest) {
  return vitest.projects.filter((project) => project.browser!.state.orchestrators.size > 0).length
}

function getSessionIds(vitest: Vitest): Set<string> {
  return (vitest as any)._browserSessions.sessionIds
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

    const { fs, vitest, ctx } = await runInlineBrowserTests(files, {
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
    // only the instance that is still open keeps its session
    expect(getSessionIds(ctx!).size).toBe(1)
  },
)

test.runIf(provider.name === 'playwright')(
  'opens a new page when the page of an instance was closed',
  async () => {
    const { fs, vitest } = await runInlineBrowserTests(
      {
        'label.ts': `export const label = 'label'`,
        'closing.test.ts': `
          import { test } from 'vitest'
          import { commands } from 'vitest/browser'
          import { label } from './label'
          test('closes its own page', async () => {
            if (label === 'label') {
              await commands.closePage()
            }
          })
        `,
      },
      {
        watch: true,
        maxWorkers: 1,
        browser: {
          instances: [{ browser, name: names[0] }],
          commands: {
            async closePage(context) {
              await context.page.close()
            },
          },
        },
        reporters: ['default'],
      },
    )

    expect(vitest.stdout).toMatch(/Errors {2}1 error/)

    vitest.resetOutput()
    fs.editFile('label.ts', () => `export const label = 'fixed'`)
    await vitest.waitForStdout('Test Files  1 passed')

    expect(vitest.stderr).toBe('')
  },
)

test.runIf(provider.name === 'playwright')(
  'does not share a persistent context between the pages of an instance',
  async () => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'vitest-persistent-context-'))
    onTestFinished(() => rmSync(userDataDir, { recursive: true, force: true }))

    const files: Record<string, string> = {
      'quick.test.ts': `
        import { test } from 'vitest'
        test('runs in quick', () => {})
      `,
    }
    for (let i = 0; i < 4; i++) {
      files[`slow-${i}.test.ts`] = `
        import { expect, test } from 'vitest'
        import { commands } from 'vitest/browser'
        test('runs alone in its context', async () => {
          await new Promise(resolve => setTimeout(resolve, 300))
          expect(await commands.pagesInContext()).toBe(1)
        })
      `
    }

    const { stderr, testTree } = await runInlineBrowserTests(files, {
      maxWorkers: 2,
      browser: {
        instances: [
          {
            browser,
            name: 'slow',
            include: ['slow-*.test.ts'],
            provider: playwright({ persistentContext: userDataDir }),
          },
          { browser, name: 'quick', include: ['quick.test.ts'] },
        ],
        commands: {
          pagesInContext(context) {
            return context.context.pages().length
          },
        },
      },
    })

    expect(stderr).toMatchInlineSnapshot(`
      "The persistentContext option is ignored because tests are running in parallel.
      "
    `)
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "quick.test.ts": {
          "runs in quick": "passed",
        },
        "slow-0.test.ts": {
          "runs alone in its context": "passed",
        },
        "slow-1.test.ts": {
          "runs alone in its context": "passed",
        },
        "slow-2.test.ts": {
          "runs alone in its context": "passed",
        },
        "slow-3.test.ts": {
          "runs alone in its context": "passed",
        },
      }
    `)
  },
)

test.runIf(provider.name === 'playwright')(
  'finishes the run after every instance, even when one of them fails',
  async () => {
    const events: string[] = []

    const { ctx, root, testTree } = await runInlineBrowserTests(
      {
        'failing.test.ts': `
          import { test } from 'vitest'
          import { commands } from 'vitest/browser'
          test('closes its own page', async () => {
            await commands.closePage()
          })
        `,
        'slow.test.ts': `
          import { test } from 'vitest'
          test('runs in slow', async () => {
            await new Promise(resolve => setTimeout(resolve, 500))
          })
        `,
      },
      {
        maxWorkers: 2,
        browser: {
          instances: [
            { browser, name: 'failing', include: ['failing.test.ts'] },
            { browser, name: 'slow', include: ['slow.test.ts'] },
          ],
          commands: {
            async closePage(context) {
              await context.page.close()
            },
          },
        },
        reporters: [
          {
            onTestModuleEnd(module: TestModule) {
              events.push(`end ${module.project.name}`)
            },
            onTestRunEnd() {
              events.push('run end')
            },
          },
        ],
      },
    )

    expect(events).toEqual(['end slow', 'run end'])
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "failing.test.ts": {
          "closes its own page": "pending",
        },
        "slow.test.ts": {
          "runs in slow": "passed",
        },
      }
    `)
    expect(
      ctx!.state.getUnhandledErrors().map((error: any) => error.message.replace(root, '<root>')),
    ).toMatchInlineSnapshot(`
      [
        "Failed to run the test <root>/failing.test.ts.",
      ]
    `)
  },
)

test.runIf(provider.name === 'playwright')(
  'reuses the pages of instances that stayed open on rerun',
  async () => {
    const files: Record<string, string> = {
      'label.ts': `export const label = 'label'`,
    }
    for (const name of names) {
      files[`${name}.test.ts`] = `
        import { test } from 'vitest'
        import { commands } from 'vitest/browser'
        import { label } from './label'
        test('records the page in ${name}', async () => {
          await commands.recordSession(label)
        })
      `
    }
    const runs: Record<string, string>[] = []

    const { fs, vitest } = await runInlineBrowserTests(files, {
      watch: true,
      maxWorkers: 2,
      browser: {
        instances: createInstances(),
        commands: {
          recordSession(context) {
            runs.at(-1)![context.project.name] = context.sessionId
          },
        },
      },
      reporters: [
        'default',
        {
          onTestRunStart() {
            runs.push({})
          },
        },
      ],
    })

    await vitest.waitForStdout(`Test Files  ${names.length} passed`)

    vitest.resetOutput()
    fs.editFile('label.ts', (content) => `${content}\n`)
    await vitest.waitForStdout(`Test Files  ${names.length} passed`)

    expect(vitest.stderr).toBe('')
    const [first, second] = runs
    // the closed instance takes the slot of whichever open instance finishes first
    expect(names.filter((name) => first[name] === second[name])).toHaveLength(2)
  },
)
