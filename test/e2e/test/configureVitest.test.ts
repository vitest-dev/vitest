import type { ViteUserConfig } from 'vitest/config'
import type { TestProject, TestUserConfig, VitestOptions } from 'vitest/node'
import { playwright } from '@vitest/browser-playwright'
import { parseAst } from 'vite'
import { expect, onTestFinished, test } from 'vitest'
import { createVitest } from 'vitest/node'
import { runInlineTests } from '../../test-utils'

async function vitest(cliOptions: TestUserConfig, configValue: TestUserConfig = {}, viteConfig: ViteUserConfig = {}, vitestOptions: VitestOptions = {}) {
  const vitest = await createVitest('test', { ...cliOptions, config: false, watch: false }, { ...viteConfig, test: configValue as any }, vitestOptions)
  onTestFinished(() => vitest.close())
  return vitest
}

test.for(['node', 'browser'])('mock export backend follows the module-runner environment (%s)', async (mode) => {
  const run = await runInlineTests({
    'dependency.js': 'export const value = 1',
    'reexport.js': `import { value } from './dependency.js'; import { vi } from 'vitest'; vi.hoisted(() => ({})); export { value }`,
    'basic.test.js': `
import { expect, test } from 'vitest'
import { value } from './dependency.js'
test('runtime starts', () => expect(value).toBe(1))
    `,
  }, {
    // Keep the started server alive for the transform assertions below.
    watch: true,
    ...(mode === 'browser'
      ? { browser: { enabled: true, headless: true, provider: playwright(), instances: [{ browser: 'chromium' as const }] } }
      : {}),
    $viteConfig: { environments: { __vitest_vm__: {} } },
  })
  expect(run.stderr).toBe('')
  expect(run.testTree()).toEqual({ 'basic.test.js': { 'runtime starts': 'passed' } })

  const id = run.fs.resolveFile('reexport.js')
  for (const name of ['ssr', 'client', '__vitest_vm__']) {
    const environment = run.ctx!.vite.environments[name]
    const result = await environment.transformRequest(id)
    const body = parseAst(result!.code).body
    const exports = environment.pluginContainer.getModuleInfo(id)?.meta.vitestHoistedExports
    const usesModuleRunner = name !== '__vitest_vm__' && (name !== 'client' || mode !== 'browser')
    expect(exports, name).toBe(usesModuleRunner
      ? '__vite_ssr_exportName__("value", () => { try { return __vi_import_0__.value } catch {} });\n'
      : null)
    expect(body.filter(node => node.type === 'ExportNamedDeclaration'), name)
      .toHaveLength(usesModuleRunner ? 0 : 1)
  }
})

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

test('injected plugin is not filtered by the --project filter when it\'s overridden', async () => {
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
  await expect(() => throws({
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
  ).rejects.toThrow('Project name "project-1" is not unique. All projects should have unique names. Make sure your configuration is correct.')

  await expect(() => throws({
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
  ).rejects.toThrow('Project name "project-1" is not unique. All projects should have unique names. Make sure your configuration is correct.')

  await expect(() => throws({
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
  ).rejects.toThrow('Project name "project-1" is not unique. All projects should have unique names. Make sure your configuration is correct.')
})

test('can access browser.instances[].browser', async () => {
  const names: { browser: string; project: string }[] = []

  await vitest({}, {
    include: [],
    name: 'custom-project-name',
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium', name: 'custom-name-for-chromium-browser' },
        { browser: 'webkit', name: 'custom-name-for-webkit-browser' },
        { browser: 'firefox', name: 'custom-name-for-firefox-browser' },
      ],
    },
  }, {
    plugins: [
      {
        name: 'test',
        configureVitest(context) {
          names.push({ browser: context.project.config.browser.name, project: context.project.name })
        },
      },
    ],
  })

  expect(names).toMatchInlineSnapshot(`
    [
      {
        "browser": "chromium",
        "project": "custom-name-for-chromium-browser",
      },
      {
        "browser": "webkit",
        "project": "custom-name-for-webkit-browser",
      },
      {
        "browser": "firefox",
        "project": "custom-name-for-firefox-browser",
      },
    ]
  `)
})

test('can access project\'s browser.instances[].browser', async () => {
  const names: { browser: string; project: string }[] = []

  await vitest({}, {
    projects: [
      {
        plugins: [
          {
            name: 'test',
            configureVitest(context) {
              names.push({ browser: context.project.config.browser.name, project: context.project.name })
            },
          },
        ],
        test: {
          include: [],
          name: 'custom-project-name',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium', name: 'custom-name-for-chromium-browser' },
              { browser: 'webkit', name: 'custom-name-for-webkit-browser' },
              { browser: 'firefox', name: 'custom-name-for-firefox-browser' },
            ],
          },
        },
      },
    ],
  })

  expect(names).toMatchInlineSnapshot(`
    [
      {
        "browser": "chromium",
        "project": "custom-name-for-chromium-browser",
      },
      {
        "browser": "webkit",
        "project": "custom-name-for-webkit-browser",
      },
      {
        "browser": "firefox",
        "project": "custom-name-for-firefox-browser",
      },
    ]
  `)
})

async function throws(cliOptions: TestUserConfig) {
  await vitest(cliOptions)
}
