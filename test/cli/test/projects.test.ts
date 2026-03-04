import { runInlineTests, runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'

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
        extends: true,
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

it('fails if workspace is empty', async () => {
  const { stderr } = await runVitest({
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
