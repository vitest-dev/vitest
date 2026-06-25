import type { TestUserConfig } from 'vitest/node'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

async function vitest(configValue: TestUserConfig = {}) {
  const vitest = await createVitest('test', { config: false, watch: false }, { test: configValue as any })
  onTestFinished(() => vitest.close())
  return vitest
}

test('sequence options are resolved per project, except root-only seed', async () => {
  const v = await vitest({
    sequence: {
      concurrent: false,
      hooks: 'stack',
      setupFiles: 'parallel',
      seed: 123,
    },
    projects: [
      {
        test: {
          name: 'custom',
          sequence: {
            concurrent: true,
            hooks: 'list',
            setupFiles: 'list',
            shuffle: { tests: true },
          },
        },
      },
    ],
  })

  const project = v.projects.find(p => p.name === 'custom')!
  expect(project.serializedConfig.sequence).toMatchObject({
    concurrent: true,
    hooks: 'list',
    setupFiles: 'list',
    // `shuffle` is the resolved test-level boolean
    shuffle: true,
    // `seed` is shared from the root config across all projects
    seed: 123,
  })
})
