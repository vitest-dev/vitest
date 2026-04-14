/**
 * This test file exists because the output of "ssr.transformRequest" in Vite has a discrepancy between v7.1.5 and 8.0.8
 * Run the 'run transform' test in this file for more info..
 */

import type { TestUserConfig } from 'vitest/node'
import type { TestFsStructure } from '../../test-utils/index.ts'
import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, test } from 'vitest'
import { runVitestCli, useFS } from '../../test-utils/index.ts'

const VITE_VERSIONS = ['7.1.5', '8.0.8'] as const

interface TestProjectOptions {
  viteVersion: string
  vitestConfig: TestUserConfig
  extraFiles?: TestFsStructure
  rootLocation?: string
}

interface TestProject {
  root: string
  run: (cli?: string[]) => ReturnType<typeof runVitestCli>
}

function createTestProject({
  viteVersion,
  vitestConfig,
  extraFiles = {},
  // Uses the OS temp directory since we don't want node to use packages in this repo
  rootLocation = tmpdir(),
}: TestProjectOptions): TestProject {
  const root = resolve(rootLocation, `vitest-test-${crypto.randomUUID()}`)

  useFS(root, {
    ...extraFiles,
    'package.json': JSON.stringify(
      {
        name: 'vitest-test',
        type: 'module',
        private: true,
        dependencies: {
          tsx: 'latest',
          vite: viteVersion,
          vitest: 'latest',
        },
      },
      null,
      2,
    ),
    'basic.test.ts': /* ts */ `
      import { expect, test } from 'vitest'
      test('basic', () => {
        expect(1).toBe(1)
      })
    `,
    'Uitls/test-extend.ts': /* ts */ `
      import { test as baseTest } from 'vitest';

      export const it = baseTest.extend({
        /* fixtures */
      });
    `,
    'vi-mock-commented.test.ts': /* ts */ `
      import { describe } from 'vitest';
      import { it } from './Utils/test-extend.ts';

      // vi.mock('@/composables/test.js', async (importOriginal) => { });

      describe('should included', () => {
        it('is included because of workspace plugin setting', () => {});
      });
      describe('should included', () => {
        describe('nested', () => {
          it('is included because of workspace plugin setting', ({ server }) => {});
        });
      });
    `,
    'vi-mock-uncommented.test.ts': /* ts */ `
      import { describe } from 'vitest';
      import { it } from './Utils/test-extend.ts';

      vi.mock('@/composables/test.js', async (importOriginal) => { });

      describe('should included', () => {
        it('is included because of workspace plugin setting', () => {});
      });
      describe('should included', () => {
        describe('nested', () => {
          it('is included because of workspace plugin setting', ({ server }) => {});
        });
      });
    `,
    'ssr-transform.ts': /* ts */ `
      import { createVitest } from 'vitest/node';
      import { fileURLToPath } from 'node:url';
      import path from 'node:path';
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const run = async () => {
        try {
          const root = path.resolve(__dirname, '');
          const vitest = await createVitest('test', {
            config: path.join(root, 'vitest.config.ts'),
            root,
          });
          const project = vitest.getProjectByName('');

          const filepath = path.join(root, 'vi-mock-commented.test.ts');

          // Get the transformed code that would be passed to astParseFile
          const ssrResult = await project.vite.environments.ssr.transformRequest(
            filepath
          );
          console.log('=== Transformed code ===');
          console.log(ssrResult.code);
          console.log('=== end ===');

          await vitest.close()
        } catch (err) {
          console.error(err);
        }
      };
      run();
    `,
    'parse-test.ts': /* ts */ `
      import { createVitest } from 'vitest/node';
      import { fileURLToPath } from 'node:url';
      import path from 'node:path';
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const run = async () => {
        try {
          const root = path.resolve(__dirname, '');
          const vitest = await createVitest('test', {
            config: path.join(root, 'vitest.config.ts'),
            root,
          });
          const project = vitest.getProjectByName('');

          const filepath = path.join(root, 'vi-mock-commented.test.ts');
          const file = project.createSpecification(filepath);
          const mods = await vitest.experimental_parseSpecification(file);

          console.log('\\n=== Parsed tasks ===');
          const printTask = (task, indent = '') => {
            console.log(
              \`\${indent}- \${task.type}: \${task.name} (location: \${JSON.stringify(
                task.location
              )})\`
            );
            if (task.tasks) {
              for (const t of task.tasks) {
                printTask(t, indent + '  ');
              }
            }
          };
          for (const t of mods.task.tasks) {
            printTask(t);
          }

          await vitest.close()
        } catch (err) {
          console.error(err);
        }
      };
      run();
    `,
    'vitest.config.ts': /* ts */ `
      export default {
        test: ${JSON.stringify(vitestConfig, null, 2)}
      }
    `,
  })

  execSync(
    `pnpm install`,
    { cwd: root, stdio: 'ignore' },
  )

  return {
    root,
    run: (cli: string[] = []) =>
      runVitestCli(
        {
          nodeOptions: {
            cwd: root,
            env: {
              CI: '',
              GITHUB_ACTIONS: undefined,
            },
          },
        },
        '--root',
        root,
        '--no-watch',
        ...cli,
      ),
  }
}

describe.each(VITE_VERSIONS)('static collect with vite@%s', (version) => {
  let project: TestProject

  beforeEach(() => {
    project = createTestProject({
      viteVersion: version,
      vitestConfig: {
        projects: [{ test: { name: 'unit', exclude: ['vi-mock-commented.test.ts', 'vi-mock-uncommented.test.ts'] } }],
      },
    })
  })

  test('runs the suite successfully', async () => {
    const { stdout, stderr, exitCode } = await project.run()

    expect(exitCode, `stderr:\n${stderr}\nstdout:\n${stdout}`).toBe(0)
    expect(stdout).toContain(`Test Files  1 passed (1)\n      Tests  1 passed (1)\n`)
  })

  test('resolves the pinned vite version at runtime', async () => {
    const resolved = execSync(
      `node -e "console.log(require('vite/package.json').version)"`,
      { cwd: project.root, encoding: 'utf8' },
    ).trim()

    expect(resolved).toBe(version)
  })

  // This test exists just to provide info and is meant to always pass
  test('run transform', async () => {
    console.info('Root directory : ', project.root)

    const run = execSync(
      'pnpm tsx ssr-transform.ts',
      { cwd: project.root, encoding: 'utf8' },
    )

    console.info(run)
  })

  // test will fail for Vite v8.0.8
  test('run parse', async () => {
    console.info('Root directory : ', project.root)

    const run = execSync(
      'pnpm tsx parse-test.ts',
      { cwd: project.root, encoding: 'utf8' },
    )

    expect(run).toContain(`=== Parsed tasks ===
- suite: should included (location: {"line":7,"column":6})
  - test: is included because of workspace plugin setting (location: {"line":8,"column":8})
- suite: should included (location: {"line":10,"column":6})
  - suite: nested (location: {"line":11,"column":8})
    - test: is included because of workspace plugin setting (location: {"line":12,"column":10})`)
  })
})
