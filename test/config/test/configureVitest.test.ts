import type { ViteUserConfig } from 'vitest/config'
import type { TestProject, TestUserConfig, VitestOptions } from 'vitest/node'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'

async function vitest(cliOptions: TestUserConfig, configValue: TestUserConfig = {}, viteConfig: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  const vitest = await createVitest('test', { ...cliOptions, watch: false }, { ...viteConfig, test: configValue as any }, vitestOptions)
  onTestFinished(() => vitest.close())
  return vitest
}

test('can change global configuration', async () => {
  const v = await vitest({}, {}, {
    plugins: [
      {
        name: 'test',
        configureVitest({ vitest }) {
          vitest.config.coverage.enabled = true
          vitest.config.coverage.exclude = ['**/*']
          vitest.config.setupFiles.push('test/setup.ts')
        },
      },
    ],
  })
  expect(v.config.coverage.enabled).toBe(true)
  expect(v.config.coverage.exclude).toEqual(['**/*'])
  // setup is not resolved
  expect(v.config.setupFiles).toEqual(['test/setup.ts'])
})

test('can change the project and the global configurations', async () => {
  const v = await vitest({}, {
    projects: [
      {
        plugins: [
          {
            name: 'test',
            configureVitest({ vitest, project }) {
              vitest.config.setupFiles.push('test/setup.ts')
              project.config.setupFiles.push('test/project-setup.ts')
            },
          },
        ],
      },
    ],
  })

  expect(v.config.setupFiles).toEqual(['test/setup.ts'])
  const rootProject = v.getRootProject()

  expect(v.projects).toHaveLength(1)

  const project = v.projects[0]
  expect(project).not.toBe(rootProject)
  expect(project.config.setupFiles).toEqual(['test/project-setup.ts'])
})

test('plugin is not called if the project is filtered out', async () => {
  const { projects } = await vitest({
    project: 'project-2',
  }, {
    projects: [
      {
        test: {
          name: 'project-1',
        },
        plugins: [
          {
            name: 'test',
            configureVitest() {
              expect.unreachable()
            },
          },
        ],
      },
      {
        test: {
          name: 'project-2',
        },
      },
    ],
  })
  expect(projects).toHaveLength(1)
  expect(projects[0].name).toBe('project-2')
})

test('can inject the plugin', async () => {
  let newWorkspace: TestProject[] = []
  const v = await vitest({}, {}, {
    plugins: [
      {
        name: 'test',
        async configureVitest({ injectTestProjects }) {
          newWorkspace = await injectTestProjects({
            test: {
              name: 'project-1',
            },
          })
        },
      },
    ],
  })
  expect(v.projects).toHaveLength(2)
  // the default project that called configureVitest
  expect(v.projects[0].name).toBe('')
  expect(v.projects[1].name).toBe('project-1')

  expect(newWorkspace).toHaveLength(1)
  expect(newWorkspace[0].name).toBe('project-1')
})

test('injected plugin is filtered by the --project filter', async () => {
  let newWorkspace: TestProject[] = []
  const { projects } = await vitest({
    project: 'project-1',
    projects: [
      {
        test: {
          name: 'project-1',
        },
        plugins: [
          {
            name: 'test',
            async configureVitest({ injectTestProjects }) {
              newWorkspace = await injectTestProjects({
                test: {
                  name: 'project-2',
                },
              })
            },
          },
        ],
      },
    ],
  })
  expect(projects).toHaveLength(1)
  expect(projects[0].name).toBe('project-1')

  expect(newWorkspace).toHaveLength(0)
})

test('injected plugin is not filtered by the --project filter when it\'s overriden', async () => {
  let newWorkspace: TestProject[] = []
  const { projects } = await vitest({
    project: 'project-1',
    projects: [
      {
        test: {
          name: 'project-1',
        },
        plugins: [
          {
            name: 'test',
            async configureVitest({ vitest, injectTestProjects }) {
              vitest.config.project.push('project-2')
              newWorkspace = await injectTestProjects({
                test: {
                  name: 'project-2',
                },
              })
            },
          },
        ],
      },
    ],
  })
  expect(projects).toHaveLength(2)
  expect(projects[0].name).toBe('project-1')
  expect(projects[1].name).toBe('project-2')

  expect(newWorkspace).toHaveLength(1)
  expect(newWorkspace[0].name).toBe('project-2')
})

test('adding a plugin with existing name throws and error', async () => {
  await expect(() => vitest({
    projects: [
      {
        test: {
          name: 'project-1',
        },
        plugins: [
          {
            name: 'test',
            async configureVitest({ injectTestProjects }) {
              await injectTestProjects({
                test: {
                  name: 'project-1',
                },
              })
            },
          },
        ],
      },
    ],
  }),
  ).rejects.toThrowError('Project name "project-1" is not unique. All projects should have unique names. Make sure your configuration is correct.')

  await expect(() => vitest({
    projects: [
      {
        plugins: [
          {
            name: 'test',
            async configureVitest({ injectTestProjects }) {
              await injectTestProjects({
                test: {
                  name: 'project-1',
                },
              })
              await injectTestProjects({
                test: {
                  name: 'project-1',
                },
              })
            },
          },
        ],
      },
    ],
  }),
  ).rejects.toThrowError('Project name "project-1" is not unique. All projects should have unique names. Make sure your configuration is correct.')

  await expect(() => vitest({
    projects: [
      {
        plugins: [
          {
            name: 'test',
            async configureVitest({ injectTestProjects }) {
              await injectTestProjects([
                {
                  test: {
                    name: 'project-1',
                  },
                },
                {
                  test: {
                    name: 'project-1',
                  },
                },
              ])
            },
          },
        ],
      },
    ],
  }),
  ).rejects.toThrowError('Project name "project-1" is not unique. All projects should have unique names. Make sure your configuration is correct.')
})
