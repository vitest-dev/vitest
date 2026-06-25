import type { TestUserConfig } from 'vitest/node'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

async function vitest(configValue: TestUserConfig = {}) {
  const vitest = await createVitest('test', { config: false, watch: false }, { test: configValue as any })
  onTestFinished(() => vitest.close())
  return vitest
}

test('per-project sequence options are serialized from the project config, seed stays global', async () => {
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

test('a shared seed is resolved when a project shuffles even if the root config does not', async () => {
  const v = await vitest({
    // root does not shuffle and does not set a seed
    projects: [
      {
        test: {
          name: 'shuffled',
          sequence: {
            shuffle: { tests: true },
          },
        },
      },
    ],
  })

  const project = v.projects.find(p => p.name === 'shuffled')!
  const { shuffle, seed } = project.serializedConfig.sequence
  expect(shuffle).toBe(true)
  // the seed must be defined so the per-project shuffle is reproducible
  expect(typeof seed).toBe('number')
  // and it is the shared root seed
  expect(seed).toBe(v.config.sequence.seed)
})
