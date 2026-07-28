import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { runInlineTests, runVitest, ts } from '#test-utils'

it('runs the workspace if there are several vitest config files', async () => {
  const { stderr, stdout } = await runVitest({
    root: 'fixtures/workspace/several-configs',
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('workspace/several-configs')
  expect(stdout).toContain('| 1_test')
  expect(stdout).toContain('| 2_test')
  expect(stdout).toContain('1 + 1 = 2')
  expect(stdout).toContain('2 + 2 = 4')
})

it('correctly resolves workspace projects with a several folder globs', async () => {
  const { stderr, stdout } = await runVitest({
    root: 'fixtures/workspace/several-folders',
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('test - a')
  expect(stdout).toContain('test - b')
})

it('supports glob negation pattern', async () => {
  const { stderr, stdout } = await runVitest({
    root: 'fixtures/workspace/negated',
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('test - a')
  expect(stdout).toContain('test - c')
  expect(stdout).not.toContain('test - b')
})

it('fails if project names are identical with a nice error message', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/workspace/invalid-duplicate-configs',
  }, [], { fails: true })
  expect(stderr).toContain(
    `Project name "test" from "vitest.config.two.js" is not unique. The project is already defined by "vitest.config.one.js".

Your config matched these files:
 - vitest.config.one.js
 - vitest.config.two.js

All projects should have unique names. Make sure your configuration is correct.`,
  )
})

it('fails if project names are identical inside the inline config', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/workspace/invalid-duplicate-inline',
  }, [], { fails: true })
  expect(stderr).toContain(
    'Project name "test" is not unique. All projects should have unique names. Make sure your configuration is correct.',
  )
})

it('fails if referenced file doesnt exist', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/workspace/invalid-non-existing-config',
  }, [], { fails: true })
  expect(stderr).toContain(
    `Projects definition references a non-existing file or a directory: ${resolve('fixtures/workspace/invalid-non-existing-config/vitest.config.js')}`,
  )
})

it('vite import analysis is applied when loading workspace config', async () => {
  const { stderr, stdout } = await runVitest({
    root: 'fixtures/workspace/config-import-analysis',
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('test - a')
})

it('can define inline workspace config programmatically', async () => {
  const { stderr, stdout } = await runVitest({
    root: 'fixtures/workspace/api',
    env: {
      TEST_ROOT: '1',
    },
    projects: [
      {
        test: {
          name: 'project-1',
        },
      },
      {
        test: {
          name: 'project-2',
          env: {
            TEST_ROOT: '2',
          },
        },
      },
      {
        extends: './vite.custom.config.js',
        test: {
          name: 'project-3',
        },
      },
    ],
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('project-1')
  expect(stdout).toContain('project-2')
  expect(stdout).toContain('project-3')
  expect(stdout).toContain('3 passed')
})

it('correctly inherits the root config', async () => {
  const { stderr, stdout } = await runVitest({
    root: 'fixtures/workspace/config-extends',
  })
  expect(stderr).toBe('')
  expect(stdout).toContain('repro.test.js > importing a virtual module')
})

describe('the root config inheritance', () => {
  const basicTest = ts`
    import { test } from 'vitest'
    test('runs', () => {})
  `

  it('inline projects inherit options from the root config by default', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          testTimeout: 1234,
          projects: [
            { test: { name: 'inherited' } },
            { extends: false, test: { name: 'isolated' } },
          ],
        },
      },
      'basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    const timeouts = Object.fromEntries(
      ctx!.projects.map(project => [project.name, project.config.testTimeout]),
    )
    expect(timeouts).toEqual({
      inherited: 1234,
      isolated: 5000,
    })
    expect(ctx!.projects.map(project => project.config.projects)).toEqual([
      undefined,
      undefined,
    ])
  })

  it('the root name and globalSetup are not inherited by the projects', async () => {
    const { stderr, ctx, fs } = await runInlineTests({
      'globalSetup.js': ts`
        import { existsSync, readFileSync, writeFileSync } from 'node:fs'
        import { resolve } from 'node:path'

        export default function setup(project) {
          const file = resolve(project.config.root, 'setup-runs.txt')
          const runs = existsSync(file) ? Number(readFileSync(file, 'utf-8')) : 0
          writeFileSync(file, String(runs + 1))
        }
      `,
      'vitest.config.js': {
        test: {
          name: 'root',
          globalSetup: './globalSetup.js',
          projects: [
            { test: {} },
            { test: {} },
          ],
        },
      },
      'basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    expect(ctx!.projects.map(project => project.name)).toEqual(['0', '1'])
    expect(fs.readFile('setup-runs.txt')).toBe('1')
  })

  it('globalSetup from an extended non-root config runs for every project', async () => {
    const { stderr, fs } = await runInlineTests({
      'globalSetup.js': ts`
        import { existsSync, readFileSync, writeFileSync } from 'node:fs'
        import { resolve } from 'node:path'

        export default function setup(project) {
          const file = resolve(project.config.root, 'setup-runs.txt')
          const runs = existsSync(file) ? Number(readFileSync(file, 'utf-8')) : 0
          writeFileSync(file, String(runs + 1))
        }
      `,
      'vitest.shared.js': { test: { globalSetup: './globalSetup.js' } },
      'vitest.config.js': {
        test: {
          projects: [
            { extends: './vitest.shared.js', test: { name: 'a' } },
            { extends: './vitest.shared.js', test: { name: 'b' } },
          ],
        },
      },
      'basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    expect(fs.readFile('setup-runs.txt')).toBe('2')
  })

  it('the project tags replace the inherited tags', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          tags: [{ name: 'shared', retry: 2 }],
          projects: [
            // the same tag name would be a duplicate tag error
            // if the arrays were merged instead of replaced
            { test: { name: 'own-tags', tags: [{ name: 'shared', retry: 5 }] } },
            { test: { name: 'inherited-tags' } },
          ],
        },
      },
      'basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    const retries = Object.fromEntries(
      ctx!.projects.map(project => [
        project.name,
        project.config.tags.find(tag => tag.name === 'shared')!.retry,
      ]),
    )
    expect(retries).toEqual({
      'own-tags': 5,
      'inherited-tags': 2,
    })
  })
})

it('fails if workspace is empty', async () => {
  const { stderr } = await runVitest({
    config: false,
    projects: [],
  }, [], { fails: true })
  expect(stderr).toContain('No projects were found. Make sure your configuration is correct. The projects definition: [].')
})

it('fails if workspace is filtered by the project', async () => {
  const { stderr } = await runVitest({
    project: 'non-existing',
    root: 'fixtures/workspace/config-empty',
    config: './vitest.config.js',
    projects: [
      './vitest.config.js',
    ],
  }, [], { fails: true })
  expect(stderr).toContain(`No projects were found. Make sure your configuration is correct. The filter matched no projects: non-existing. The projects definition: [
    "./vitest.config.js"
].`)
})

describe('the config file names', () => {
  it('[glob] the name has "unit" between "vitest" and "config" and works', async () => {
    const { exitCode } = await runInlineTests({
      'vitest.unit.config.js': {},
      'vitest.config.js': {
        test: {
          passWithNoTests: true,
          projects: ['./vitest.*.config.js'],
        },
      },
    })

    expect(exitCode).toBe(0)
  })

  it('[glob] the name does not start with "vite"/"vitest" and throws an error', async () => {
    const { stderr } = await runInlineTests({
      'unit.config.js': {},
      'vitest.config.js': {
        test: {
          projects: ['./*.config.js'],
        },
      },
    }, {}, { fails: true })

    expect(stderr).toContain('The projects glob matched a file "unit.config.js", but it should also either start with "vitest.config"/"vite.config" or match the pattern "(vitest|vite).*.config.*".')
  })

  it('[file] the name has "unit" between "vitest" and "config" and works', async () => {
    const { exitCode } = await runInlineTests({
      'vitest.unit.config.js': {},
      'vitest.config.js': {
        test: {
          passWithNoTests: true,
          projects: ['./vitest.unit.config.js'],
        },
      },
    })

    expect(exitCode).toBe(0)
  })

  it('[glob] the name has "unit-test" (with hyphen) between "vitest" and "config" and works', async () => {
    const { exitCode } = await runInlineTests({
      'vitest.unit-test.config.js': {},
      'vitest.config.js': {
        test: {
          passWithNoTests: true,
          projects: ['./vitest.*.config.js'],
        },
      },
    })

    expect(exitCode).toBe(0)
  })

  it('[file] the name has "unit-test" (with hyphen) between "vitest" and "config" and works', async () => {
    const { exitCode } = await runInlineTests({
      'vitest.unit-test.config.js': {},
      'vitest.config.js': {
        test: {
          passWithNoTests: true,
          projects: ['./vitest.unit-test.config.js'],
        },
      },
    })

    expect(exitCode).toBe(0)
  })

  it('[file] the name does not start with "vite"/"vitest" and throws an error', async () => {
    const { stderr } = await runInlineTests({
      'unit.config.js': {},
      'vitest.config.js': {
        test: {
          passWithNoTests: true,
          projects: ['./unit.config.js'],
        },
      },
    }, {}, { fails: true })

    expect(stderr).toContain('The file "unit.config.js" must start with "vitest.config"/"vite.config" or match the pattern "(vitest|vite).*.config.*" to be a valid project config.')
  })
})

describe('nested projects', () => {
  const basicTest = ts`
    import { test } from 'vitest'
    test('runs', () => {})
  `

  it('a file-based project with `projects` becomes a container and only its projects run', async () => {
    const { stderr, ctx, results } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          projects: [
            { test: { name: 'unit', include: ['**/*.unit.test.js'] } },
            { test: { name: 'e2e', include: ['**/*.e2e.test.js'] } },
          ],
        },
      },
      'app/basic.unit.test.js': basicTest,
      'app/basic.e2e.test.js': basicTest,
    })
    expect(stderr).toBe('')
    expect(ctx!.projects.map(project => project.name)).toEqual([
      'app (unit)',
      'app (e2e)',
    ])
    // the container's own include doesn't run anything
    expect(results).toHaveLength(2)
  })

  it('a directory reference with a config declaring `projects` becomes a container', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app'],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          projects: [
            { test: { name: 'unit' } },
          ],
        },
      },
      'app/basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    expect(ctx!.projects.map(project => project.name)).toEqual(['app (unit)'])
  })

  it('file-based projects of a container are namespaced with derived names', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          projects: ['./unit/vitest.config.js'],
        },
      },
      'app/unit/vitest.config.js': {},
      'app/unit/basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    expect(ctx!.projects.map(project => project.name)).toEqual(['app (unit)'])
  })

  it('nested containers namespace their projects recursively', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          projects: ['./sub/vitest.config.js'],
        },
      },
      'app/sub/vitest.config.js': {
        test: {
          name: 'sub',
          projects: [
            { test: { name: 'leaf' } },
          ],
        },
      },
      'app/sub/basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    expect(ctx!.projects.map(project => project.name)).toEqual(['app (sub) (leaf)'])
  })

  it('inline projects ignore the `projects` field', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: [
            {
              test: {
                name: 'main',
                // inline projects cannot spawn other projects
                projects: [{ test: { name: 'ignored' } }],
              } as import('vitest/node').ProjectConfig,
            },
          ],
        },
      },
      'basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    expect(ctx!.projects.map(project => project.name)).toEqual(['main'])
  })

  it('a container can list its own config file to also run its tests', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          include: ['self.test.js'],
          projects: [
            './vitest.config.js',
            { test: { name: 'unit', include: ['unit.test.js'] } },
          ],
        },
      },
      'app/self.test.js': basicTest,
      'app/unit.test.js': basicTest,
    })
    expect(stderr).toBe('')
    // inline projects always come before file-based projects
    expect(ctx!.projects.map(project => project.name)).toEqual([
      'app (unit)',
      'app',
    ])
  })

  it('fails on a circular projects definition', async () => {
    const { stderr } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./vitest.a.config.js'],
        },
      },
      'vitest.a.config.js': {
        test: { name: 'a', projects: ['./vitest.b.config.js'] },
      },
      'vitest.b.config.js': {
        test: { name: 'b', projects: ['./vitest.a.config.js'] },
      },
    }, {}, { fails: true })
    expect(stderr).toContain(
      'Found a circular "projects" definition: "vitest.config.js" -> "vitest.a.config.js" -> "vitest.b.config.js" -> "vitest.a.config.js". Make sure your configuration is correct.',
    )
  })

  it('fails when a container has no projects', async () => {
    const { stderr } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': {
        test: { name: 'app', projects: [] },
      },
    }, {}, { fails: true })
    expect(stderr).toContain('No projects were found in "app/vitest.config.js". Make sure your configuration is correct.')
  })

  it('fails when nested project names collide', async () => {
    const { stderr } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          projects: [
            { test: { name: 'unit' } },
            { test: { name: 'unit' } },
          ],
        },
      },
      'app/basic.test.js': basicTest,
    }, {}, { fails: true })
    expect(stderr).toContain('Project name "app (unit)" is not unique.')
  })

  describe('the --project filter', () => {
    const structure = {
      'vitest.config.js': {
        test: {
          projects: [
            { test: { name: 'main', include: ['main.test.js'] } },
            './app/vitest.config.js',
          ],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          projects: [
            { test: { name: 'unit', include: ['**/*.unit.test.js'] } },
            { test: { name: 'e2e', include: ['**/*.e2e.test.js'] } },
          ],
        },
      },
      'main.test.js': basicTest,
      'app/basic.unit.test.js': basicTest,
      'app/basic.e2e.test.js': basicTest,
    } satisfies Parameters<typeof runInlineTests>[0]

    it('the container name selects the whole subtree', async () => {
      const { stderr, ctx } = await runInlineTests(structure, { project: 'app' })
      expect(stderr).toBe('')
      expect(ctx!.projects.map(project => project.name)).toEqual([
        'app (unit)',
        'app (e2e)',
      ])
    })

    it('the qualified name selects a single project', async () => {
      const { stderr, ctx } = await runInlineTests(structure, { project: 'app (unit)' })
      expect(stderr).toBe('')
      expect(ctx!.projects.map(project => project.name)).toEqual(['app (unit)'])
    })

    it('excluding the container name excludes the whole subtree', async () => {
      const { stderr, ctx } = await runInlineTests(structure, { project: '!app' })
      expect(stderr).toBe('')
      expect(ctx!.projects.map(project => project.name)).toEqual(['main'])
    })
  })

  it('projects extend the container config by default, not the root', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          testTimeout: 1111,
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          testTimeout: 2222,
          projects: [
            { test: { name: 'inherited' } },
            { extends: false, test: { name: 'isolated' } },
            { extends: './vitest.shared.js', test: { name: 'shared' } },
          ],
        },
      },
      'app/vitest.shared.js': {
        test: { testTimeout: 3333 },
      },
      'app/basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    const timeouts = Object.fromEntries(
      ctx!.projects.map(project => [project.name, project.config.testTimeout]),
    )
    expect(timeouts).toEqual({
      'app (inherited)': 2222,
      'app (isolated)': 5000,
      'app (shared)': 3333,
    })
  })

  it('the container globalSetup runs for every project extending it', async () => {
    const { stderr, fs } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/globalSetup.js': ts`
        import { existsSync, readFileSync, writeFileSync } from 'node:fs'
        import { resolve } from 'node:path'

        export default function setup(project) {
          const file = resolve(project.config.root, 'setup-runs.txt')
          const runs = existsSync(file) ? Number(readFileSync(file, 'utf-8')) : 0
          writeFileSync(file, String(runs + 1))
        }
      `,
      'app/vitest.config.js': {
        test: {
          name: 'app',
          globalSetup: './globalSetup.js',
          projects: [
            { test: { name: 'a' } },
            { test: { name: 'b' } },
          ],
        },
      },
      'app/basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    expect(fs.readFile('app/setup-runs.txt')).toBe('2')
  })

  it('cli overrides reach nested projects', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          testTimeout: 2222,
          projects: [
            { test: { name: 'unit' } },
          ],
        },
      },
      'app/basic.test.js': basicTest,
    }, { $cliOptions: { testTimeout: 999 } })
    expect(stderr).toBe('')
    expect(ctx!.projects.map(project => project.config.testTimeout)).toEqual([999])
  })

  it('benchmark projects are created for nested projects', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          passWithNoTests: true,
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          projects: [
            { test: { name: 'unit', benchmark: { enabled: true } } },
          ],
        },
      },
      'app/basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    expect(ctx!.projects.map(project => project.name)).toEqual([
      'app (unit)',
      'app (unit) (bench)',
    ])
  })

  it('editing a container config restarts and picks up new projects', async () => {
    const { vitest, fs } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': ts`
        export default {
          test: {
            name: 'app',
            projects: [
              { test: { name: 'one', include: ['one.test.js'] } },
              // extra
            ],
          },
        }
      `,
      'app/one.test.js': basicTest,
      'app/two.test.js': basicTest,
    }, { watch: true })

    await vitest.waitForStdout('Waiting for file changes')
    expect(vitest.stdout).toContain('app (one)')
    expect(vitest.stdout).not.toContain('app (two)')
    vitest.resetOutput()

    fs.editFile('app/vitest.config.js', content => content.replace(
      '// extra',
      `{ test: { name: 'two', include: ['two.test.js'] } },`,
    ))

    await vitest.waitForStdout('Waiting for file changes')
    expect(vitest.stdout).toContain('app (two)')
  })
})

describe('sharedViteServer', () => {
  const basicTest = ts`
    import { test } from 'vitest'
    test('runs', () => {})
  `

  it('projects without vite-affecting options share the server of the declaring config', async () => {
    const { stderr, ctx, results } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: [
            { test: { name: 'shared-a' } },
            { test: { name: 'shared-b', env: { FROM_B: '1' }, testTimeout: 1234 } },
            { test: { name: 'own-alias', alias: { x: './y.js' } } },
            { test: { name: 'own-optimizer', deps: { optimizer: { ssr: { enabled: false } } } } },
            { extends: false, test: { name: 'own-isolated' } },
          ],
        },
      },
      'basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    expect(results.every(module => module.ok())).toBe(true)

    const root = ctx!.getRootProject()
    const shared = Object.fromEntries(
      ctx!.projects.map(project => [project.name, project.vite === root.vite]),
    )
    expect(shared).toEqual({
      'shared-a': true,
      'shared-b': true,
      'own-alias': false,
      'own-optimizer': false,
      'own-isolated': false,
    })
    // the shared projects still resolve their own test options
    const sharedB = ctx!.projects.find(project => project.name === 'shared-b')!
    expect(sharedB.config.testTimeout).toBe(1234)
    expect(sharedB.config.env).toMatchObject({ FROM_B: '1' })
  })

  it('resolves the same project config as a full resolution', async () => {
    const structure = (sharedViteServer: boolean) => ({
      'globalSetup.js': ts`
        import { existsSync, readFileSync, writeFileSync } from 'node:fs'
        import { resolve } from 'node:path'

        export default function setup(project) {
          const file = resolve(project.config.root, 'setup-runs.txt')
          const runs = existsSync(file) ? Number(readFileSync(file, 'utf-8')) : 0
          writeFileSync(file, String(runs + 1))
        }
      `,
      'setup.root.js': '',
      'setup.child.js': '',
      'vitest.config.js': {
        test: {
          sharedViteServer,
          testTimeout: 4321,
          globalSetup: './globalSetup.js',
          setupFiles: ['./setup.root.js'],
          env: { FROM_ROOT: '1' },
          tags: [{ name: 'shared', retry: 2 }],
          projects: [
            { test: { name: 'first', setupFiles: ['./setup.child.js'] } },
            { test: { name: 'second', tags: [{ name: 'shared', retry: 5 }], env: { FROM_ROOT: '2' } } },
            { test: {} },
          ],
        },
      },
      'basic.test.js': basicTest,
    } satisfies Parameters<typeof runInlineTests>[0])

    const project = (ctx: NonNullable<Awaited<ReturnType<typeof runInlineTests>>['ctx']>) =>
      ctx.projects.map(project => ({
        name: project.name,
        testTimeout: project.config.testTimeout,
        setupFiles: project.config.setupFiles.map(file => file.split('/').pop()),
        env: project.config.env,
        tags: project.config.tags,
        globalSetup: project.config.globalSetup,
      }))

    const full = await runInlineTests(structure(false))
    const shared = await runInlineTests(structure(true))
    expect(full.stderr).toBe('')
    expect(shared.stderr).toBe('')
    expect(project(shared.ctx!)).toEqual(project(full.ctx!))
    // the root globalSetup runs once and is not inherited in both modes
    expect(full.fs.readFile('setup-runs.txt')).toBe('1')
    expect(shared.fs.readFile('setup-runs.txt')).toBe('1')
    // the fast path was actually taken
    const root = shared.ctx!.getRootProject()
    expect(shared.ctx!.projects.every(project => project.vite === root.vite)).toBe(true)
    expect(full.ctx!.projects.every(project => project.vite !== root.vite)).toBe(true)
    // the raw config is captured only when the feature is enabled; the root
    // keeps it for `injectTestProjects`
    expect(shared.ctx!.config._rawTestConfig).toBeDefined()
    expect(shared.ctx!.config._rawTestConfig!.projects).toBeUndefined()
    expect(full.ctx!.config._rawTestConfig).toBeUndefined()
  })

  it('cli overrides apply to shared-server projects', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          testTimeout: 4321,
          projects: [
            { test: { name: 'unit' } },
          ],
        },
      },
      'basic.test.js': basicTest,
    }, { $cliOptions: { testTimeout: 999 } })
    expect(stderr).toBe('')
    expect(ctx!.projects.map(project => project.config.testTimeout)).toEqual([999])
  })

  it('projects of a container share the container server', async () => {
    const { stderr, ctx } = await runInlineTests({
      'vitest.config.js': {
        test: {
          projects: ['./app/vitest.config.js'],
        },
      },
      'app/vitest.config.js': {
        test: {
          name: 'app',
          projects: [
            { test: { name: 'unit' } },
            { test: { name: 'e2e' } },
          ],
        },
      },
      'app/basic.test.js': basicTest,
    })
    expect(stderr).toBe('')
    const [unit, e2e] = ctx!.projects
    expect(ctx!.projects.map(project => project.name)).toEqual(['app (unit)', 'app (e2e)'])
    expect(unit.vite).toBe(e2e.vite)
    expect(unit.vite).not.toBe(ctx!.getRootProject().vite)
  })
})

describe('project filtering', () => {
  const allProjects = ['project_1', 'project_2', 'space_1']

  it.for([
    { pattern: 'project_1', expected: ['project_1'] },
    { pattern: '*', expected: allProjects },
    { pattern: '*j*', expected: ['project_1', 'project_2'] },
    { pattern: 'project*', expected: ['project_1', 'project_2'] },
    { pattern: 'space*', expected: ['space_1'] },
    { pattern: '!project_1', expected: ['project_2', 'space_1'] },
    { pattern: '!project*', expected: ['space_1'] },
    { pattern: '!project', expected: allProjects },
  ])('should match projects correctly: $pattern', async ({ pattern, expected }) => {
    const { ctx, stderr, stdout } = await runVitest({
      root: 'fixtures/project',
      reporters: ['default'],
      project: pattern,
    })

    expect(stderr).toBeFalsy()
    expect(stdout).toBeTruthy()

    for (const project of allProjects) {
      if (expected.includes(project)) {
        expect(stdout).toContain(project)
      }
      else {
        expect(stdout).not.toContain(project)
      }
    }

    expect(ctx?.projects.map(p => p.name).sort()).toEqual(expected)
  })
})
