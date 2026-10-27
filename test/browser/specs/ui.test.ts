import { describe, expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'
import { provider } from '../settings'

describe.runIf(provider.name === 'playwright')('browser ui', () => {
  test('enabled in projects setup (#10993)', async () => {
    const { stderr, exitCode, testTree } = await runInlineTests(
      {
        'basic.test.ts': /* ts */ `
          import { expect, test } from 'vitest'

          test('works', () => {
            expect(1 + 1).toBe(2)
          })
        `,
      },
      {
        watch: false,
        reporters: 'none',
        projects: [
          {
            test: {
              browser: {
                enabled: true,
                headless: true,
                ui: true,
                provider,
                instances: [{ browser: 'chromium' }],
              },
            },
          },
        ],
      },
    )

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "works": "passed",
        },
      }
    `)
  })

  test('split-pane handle does not block iframe interactions (#11170)', async () => {
    const { stderr, exitCode, testTree } = await runInlineTests(
      {
        'button.test.ts': /* ts */ `
          import { expect, test, vi } from 'vitest'
          import { userEvent } from 'vitest/browser'

          test('clicks on button', async () => {
            const spy = vi.fn()
            const button = document.createElement('button')
            button.style = 'width: 5px; height: 10px; padding: 0; border: none;'
            button.addEventListener('click', spy)
            document.body.appendChild(button)
            await userEvent.click(button, { position: { x: 1, y: 1 } })

            expect(spy).toHaveBeenCalledOnce()
          })
        `,
      },
      {
        watch: true,
        reporters: 'none',
        browser: {
          enabled: true,
          headless: true,
          ui: true,
          provider,
          instances: [{ browser: 'chromium' }],
          viewport: { width: 50, height: 50 },
        },
      },
    )

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "button.test.ts": {
          "clicks on button": "passed",
        },
      }
    `)
  })

  test('page.viewport() does not wait for an animation frame (#10831)', async () => {
    const { stderr, exitCode, testTree } = await runInlineTests(
      {
        'basic.test.ts': /* ts */ `
          import { expect, test } from 'vitest'
          import { page } from 'vitest/browser'

          test('resizes the iframe', async () => {
            await page.viewport(320, 480)
            expect(window.innerWidth).toBe(320)
            expect(window.innerHeight).toBe(480)
          })
        `,
      },
      {
        watch: false,
        reporters: 'none',
        browser: {
          enabled: true,
          headless: true,
          ui: true,
          provider,
          instances: [{ browser: 'chromium' }],
          // a page that is not rendered, like a hidden tab, gets no animation frames
          orchestratorScripts: [{ content: 'window.requestAnimationFrame = () => 0' }],
        },
      },
    )

    expect(stderr).toBe('')
    expect(exitCode).toBe(0)
    expect(testTree()).toMatchInlineSnapshot(`
      {
        "basic.test.ts": {
          "resizes the iframe": "passed",
        },
      }
    `)
  })
})
