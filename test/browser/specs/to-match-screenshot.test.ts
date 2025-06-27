import type { ViteUserConfig } from 'vitest/config.js'
import type { UserConfig } from 'vitest/node'
import type { TestFsStructure } from '../../test-utils'
import { platform } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { runVitestCli, useFS } from '../../test-utils'
import { extractToMatchScreenshotPaths } from '../fixtures/expect-dom/utils'
import utilsContent from '../fixtures/expect-dom/utils?raw'

const testFilename = 'basic.test.ts'
const testName = 'screenshot-snapshot'
const bgColor = '#fff'

const testContent = /* ts */`
import { page, server } from '@vitest/browser/context'
import { describe, test } from 'vitest'
import { render } from './utils'

const dataTestId = 'inline-test'

test('${testName}', async ({ expect }) => {
  render('<div data-testid="' + dataTestId + '" style="background-color: ${bgColor};">Inline Test</div>')

  await expect(page.getByTestId(dataTestId)).toMatchScreenshot()
})
`

const vitestConfig = {
  test: {
    browser: {
      enabled: true,
      screenshotFailures: false,
      provider: 'playwright',
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    reporters: ['verbose'],
  },
} as const satisfies ViteUserConfig

export async function runInlineTests(
  structure: TestFsStructure,
  config?: UserConfig,
) {
  const root = resolve(process.cwd(), `vitest-test-${crypto.randomUUID()}`)

  const fs = useFS(root, {
    ...structure,
    'vitest.config.ts': {
      ...vitestConfig,
      test: {
        ...vitestConfig.test,
        ...config,
      },
    },
  })

  const vitest = await runVitestCli({
    nodeOptions: {
      env: {
        CI: 'false',
        GITHUB_ACTIONS: undefined,
        NO_COLOR: 'true',
      },
    },
  }, '--root', root, '--watch')

  return {
    fs,
    root,
    ...vitest,
  }
}

describe('--watch', () => {
  test(
    'fails when creating a snapshot for the first time and does NOT update it afterwards',
    async () => {
      const { fs, stderr, vitest } = await runInlineTests(
        {
          [testFilename]: testContent,
          'utils.ts': utilsContent,
        },
      )

      const [referencePath] = extractToMatchScreenshotPaths(stderr, testName)

      expect(stderr).toContain(`No existing reference screenshot found; a new one was created. Review it before running tests again.\n\nReference screenshot:\n  ${referencePath}`)

      const referenceStat = fs.statFile(referencePath)

      fs.editFile(testFilename, content => `${content}\n`)

      vitest.resetOutput()
      await vitest.waitForStdout('Test Files  1 passed')

      expect(vitest.stdout).toContain('✓ |chromium| basic.test.ts > screenshot-snapshot')

      const newReferenceStat = fs.statFile(referencePath)

      expect(referenceStat).toEqual(newReferenceStat)
    },
  )

  test(
    'with --update creates snapshots and updates them on change',
    async () => {
      const { fs, stderr, vitest } = await runInlineTests(
        {
          [testFilename]: testContent,
          'utils.ts': utilsContent,
        },
        {
          update: true,
        },
      )

      expect(stderr).toMatchInlineSnapshot(`""`)

      const referencePath = `__screenshots__/${testFilename}/${testName}-1-${vitestConfig.test.browser.instances[0].browser}-${platform()}.png`
      const referenceStat = fs.statFile(referencePath)

      fs.editFile(testFilename, content => `${content}\n`)

      vitest.resetOutput()
      await vitest.waitForStdout('Test Files  1 passed')

      expect(vitest.stdout).toContain('✓ |chromium| basic.test.ts > screenshot-snapshot')

      const {
        atime,
        atimeMs,
        ctime,
        ctimeMs,
        mtime,
        mtimeMs,
        ...diffs
      } = fs.statFile(referencePath)

      expect(referenceStat).toEqual(expect.objectContaining(diffs))

      expect(atime.getTime()).toBeGreaterThan(referenceStat.atime.getTime())
      expect(ctime.getTime()).toBeGreaterThan(referenceStat.ctime.getTime())
      expect(mtime.getTime()).toBeGreaterThan(referenceStat.mtime.getTime())

      expect(atimeMs).toBeGreaterThan(referenceStat.atimeMs)
      expect(ctimeMs).toBeGreaterThan(referenceStat.ctimeMs)
      expect(mtimeMs).toBeGreaterThan(referenceStat.mtimeMs)
    },
  )

  test(
    'creates a reference and fails when changing the DOM content',
    async () => {
      const { fs, stderr, vitest } = await runInlineTests(
        {
          [testFilename]: testContent,
          'utils.ts': utilsContent,
        },
      )

      expect(stderr).toContain(`No existing reference screenshot found; a new one was created. Review it before running tests again.\n\nReference screenshot:`)

      fs.editFile(testFilename, content => content.replace(bgColor, '#0ff'))

      vitest.resetOutput()
      await vitest.waitForStdout('Test Files  1 failed')

      expect(vitest.stdout).toContain('× |chromium| basic.test.ts > screenshot-snapshot')
      expect(vitest.stdout).toContain('Screenshot does not match the stored reference.')
      expect(vitest.stdout).toMatch(/\d+ pixels \(ratio 0.\d{2}\) differ\./)
    },
  )
})
