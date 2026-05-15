import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

async function writeFixtureFile(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

test('vitest/browser types are available when browser provider dependencies are installed in an npm workspace', async () => {
  const workspace = await fsRoot()

  try {
    await cp(
      join(root, 'packages/vitest/browser'),
      join(workspace, 'node_modules/vitest/browser'),
      { recursive: true },
    )

    await writeFixtureFile(join(workspace, 'package.json'), JSON.stringify({
      private: true,
      workspaces: ['packages/*'],
    }))

    await writeFixtureFile(join(workspace, 'node_modules/vitest/package.json'), JSON.stringify({
      name: 'vitest',
      type: 'module',
      exports: {
        '.': { types: './dist/index.d.ts' },
        './browser': { types: './browser/context.d.ts' },
        './internal/browser': { types: './dist/browser.d.ts' },
      },
    }))
    await writeFixtureFile(join(workspace, 'node_modules/vitest/dist/index.d.ts'), 'export interface SerializedConfig {}\n')
    await writeFixtureFile(join(workspace, 'node_modules/vitest/dist/browser.d.ts'), [
      'export interface FsOptions { encoding?: string; flag?: string | number }',
      'export interface BrowserCommands {}',
      'export interface CDPSession {}',
      'export type StringifyOptions = Record<string, unknown>',
    ].join('\n'))

    await writeFixtureFile(join(workspace, 'packages/frontend/package.json'), JSON.stringify({
      name: 'frontend',
      type: 'module',
      private: true,
      devDependencies: {
        '@vitest/browser-playwright': '*',
        'vitest': '*',
      },
    }))
    await writeFixtureFile(join(workspace, 'packages/frontend/tsconfig.json'), JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        target: 'ES2022',
        strict: true,
        skipLibCheck: true,
        types: [],
      },
      include: ['test.ts'],
    }))
    await writeFixtureFile(join(workspace, 'packages/frontend/test.ts'), [
      'import { page, server, userEvent } from "vitest/browser"',
      'page.getByText("hello")',
      'server.provider satisfies string',
      'await userEvent.click(document.body)',
    ].join('\n'))

    await writeFixtureFile(join(workspace, 'packages/frontend/node_modules/@vitest/browser-playwright/package.json'), JSON.stringify({
      name: '@vitest/browser-playwright',
      type: 'module',
      exports: { './context': { types: './context.d.ts' } },
    }))
    await writeFixtureFile(
      join(workspace, 'packages/frontend/node_modules/@vitest/browser-playwright/context.d.ts'),
      'export * from "@vitest/browser/context"\n',
    )
    await writeFixtureFile(join(workspace, 'packages/frontend/node_modules/@vitest/browser/package.json'), JSON.stringify({
      name: '@vitest/browser',
      type: 'module',
      exports: { './context': { types: './context.d.ts' } },
    }))
    await writeFixtureFile(join(workspace, 'packages/frontend/node_modules/@vitest/browser/context.d.ts'), [
      'export const page: { getByText(text: string): unknown }',
      'export const server: { provider: string }',
      'export const userEvent: { click(element: Element): Promise<void> }',
    ].join('\n'))

    await expect(execFileAsync(process.execPath, [
      require.resolve('typescript/bin/tsc'),
      '-p',
      join(workspace, 'packages/frontend/tsconfig.json'),
      '--pretty',
      'false',
    ])).resolves.toMatchObject({ stdout: '', stderr: '' })
  }
  finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

async function fsRoot() {
  return await mkdtemp(join(tmpdir(), 'vitest-browser-types-'))
}
