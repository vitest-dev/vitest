import { playwright } from '@vitest/browser-playwright'
import { expect, test } from 'vitest'
import { runInlineTests, ts } from '../../test-utils'

test('should fail for non-awaited expect.element', async () => {
  const { stderr } = await runInlineTests({
    'expect-element.test.js': ts`
      import { expect, test, beforeAll } from 'vitest';
      import { page } from 'vitest/browser';

      beforeAll(() => {
        document.body.innerHTML = 'Hello Vitest!';
      });
  
      test('awaited', async () => {
        const element = page.getByText("Hello Vitest!");

        await expect.element(element).toBeInTheDocument();
      })

      test('not awaited', () => {
        const element = page.getByText("Hello Vitest!");

        expect.element(element).toBeInTheDocument();
      })
      `,
  }, {
    projects: [
      {
        test: {
          name: 'browser',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [
              { browser: 'chromium' },
            ],
          },
        },
      },
    ],
  })

  expect(stderr).toMatchSnapshot()
})
