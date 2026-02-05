import type { ViteUserConfig } from 'vitest/config'
import type { TestFsStructure } from '../../test-utils'
import { platform } from 'node:os'
import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'
import { extractToMatchScreenshotPaths } from '../fixtures/expect-dom/utils'
import utilsContent from '../fixtures/expect-dom/utils?raw'
import { provider } from '../settings'

const testFilename = 'basic.test.ts'
const testName = 'screenshot-snapshot'
const bgColor = '#fff'

const testContent = /* ts */`
import { page, server } from 'vitest/browser'
import { describe, test } from 'vitest'
import { render } from './utils'

const dataTestId = 'inline-test'

test('${testName}', async ({ expect }) => {
  render('<div data-testid="' + dataTestId + '" style="background-color: ${bgColor};">Inline Test</div>')

  await expect(page.getByTestId(dataTestId)).toMatchScreenshot()
})
`

const browser = 'chromium'

async function runBrowserTests(
  structure: TestFsStructure,
  config: ViteUserConfig['test'] = {},
) {
  return runInlineTests({
    ...structure,
    'vitest.config.js': `
      import { playwright } from '@vitest/browser-playwright'
      export default {
        test: {
          browser: {
            enabled: true,
            screenshotFailures: false,
            provider: playwright(),
            headless: true,
            instances: [{ browser: ${JSON.stringify(browser)} }],
          },
          reporters: ['verbose'],
          ...${JSON.stringify(config)},
        },
      }`,
  }, {
    $cliOptions: {
      watch: true,
    },
  })
}

describe.runIf(provider.name === 'playwright')('--watch', () => {
  test(
    'fails when creating a snapshot for the first time and does NOT update it afterwards',
    async () => {
      const { fs, stderr, vitest } = await runBrowserTests(
        {
          [testFilename]: testContent,
          'utils.ts': utilsContent,
        },
        {
          update: 'new',
        },
      )

      const [referencePath] = extractToMatchScreenshotPaths(stderr, testName)

      expect(stderr).toContain(`No existing reference screenshot found; a new one was created. Review it before running tests again.\n\nReference screenshot:\n  ${referencePath}`)

      const { atime: _1, atimeMs: _2, ...referenceStat } = fs.statFile(referencePath)

      fs.editFile(testFilename, content => `${content}\n`)

      vitest.resetOutput()
      await vitest.waitForStdout('Test Files  1 passed')

      expect(vitest.stdout).toContain('✓ |chromium| basic.test.ts > screenshot-snapshot')

      const { atime: _3, atimeMs: _4, ...newReferenceStat } = fs.statFile(referencePath)

      expect(referenceStat).toEqual(newReferenceStat)
    },
  )

  test(
    'creates a reference and fails when changing the DOM content',
    async () => {
      const { fs, stderr, vitest } = await runBrowserTests(
        {
          [testFilename]: testContent,
          'utils.ts': utilsContent,
        },
        {
          update: 'new',
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

  describe('--update', () => {
    test(
      'creates snapshot and does NOT update it if reference matches',
      async () => {
        const { fs, stderr, vitest } = await runBrowserTests(
          {
            [testFilename]: testContent,
            'utils.ts': utilsContent,
          },
          {
            update: true,
          },
        )

        expect(stderr).toMatchInlineSnapshot(`""`)

        const osPlatform = platform()
        const referencePath = `__screenshots__/${testFilename}/${testName}-1-${browser}-${osPlatform}.png`
        const referenceStat = fs.statFile(referencePath)

        fs.editFile(testFilename, content => `${content}\n`)

        vitest.resetOutput()
        await vitest.waitForStdout('Test Files  1 passed')

        expect(vitest.stdout).toContain('✓ |chromium| basic.test.ts > screenshot-snapshot')

        // only atime should change since reference should NOT be updated

        const {
          atime,
          atimeMs,
          ...diffs
        } = fs.statFile(referencePath)

        expect(referenceStat).toEqual(expect.objectContaining(diffs))

        // win32 does not update `atime` by default
        if (osPlatform === 'win32') {
          expect(atime.getTime()).toEqual(referenceStat.atime.getTime())
          expect(atimeMs).toEqual(referenceStat.atimeMs)
        }
        else {
          expect(atime.getTime()).toBeGreaterThan(referenceStat.atime.getTime())
          expect(atimeMs).toBeGreaterThan(referenceStat.atimeMs)
        }
      },
    )

    test(
      'creates snapshot and updates it if reference mismatches',
      async () => {
        const { fs, stderr, vitest } = await runBrowserTests(
          {
            [testFilename]: testContent,
            'utils.ts': utilsContent,
          },
          {
            update: true,
          },
        )

        expect(stderr).toMatchInlineSnapshot(`""`)

        const referencePath = `__screenshots__/${testFilename}/${testName}-1-${browser}-${platform()}.png`
        const referenceStat = fs.statFile(referencePath)

        fs.editFile(testFilename, content => content.replace(bgColor, '#000'))

        vitest.resetOutput()
        await vitest.waitForStdout('Test Files  1 passed')

        expect(vitest.stdout).toContain('✓ |chromium| basic.test.ts > screenshot-snapshot')

        // atime, ctime, mtime, and size should change since reference should be updated

        const {
          atime,
          atimeMs,
          ctime,
          ctimeMs,
          mtime,
          mtimeMs,
          size,
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
  })
})
