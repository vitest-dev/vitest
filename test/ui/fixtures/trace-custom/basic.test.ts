import { expect } from 'vitest'
import { test } from './trace/test'

test('custom trace', async ({ page, trace }) => {
  await page.setContent('<main><button>Before action</button></main>')

  await trace.snapshot('before action')

  const result = await trace.mark('action', async () => {
    await page.locator('main').evaluate((element) => {
      element.innerHTML = '<button>After action</button>'
    })
    return 'action result'
  }, { kind: 'action' })
  expect(result).toBe('action result')
})
