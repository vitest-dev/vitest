import type { TestContext } from 'vitest'
import { test, vi } from 'vitest'
import { page } from 'vitest/browser'

const renderContext = vi.defineHelper(async (context: TestContext) => {
  const result = context.task.result
  const content = `
<ul>
  <li>retryCount: ${result?.retryCount ?? '(none)'}</li>
  <li>repeatCount: ${result?.repeatCount ?? '(none)'}</li>
</ul>
`
  document.body.innerHTML = content
  await page.getByRole('list').mark(`renderHelper`)
})

test('repeated test', { repeats: 2 }, async ({ task }) => {
  await renderContext(task.context)
})

test('retried test', { retry: 2 }, async ({ task }) => {
  await renderContext(task.context)
  if (task.result?.retryCount !== 2) {
    throw new Error(`failed test at retry count ${task.result?.retryCount}`)
  }
})

test('repeated retried tests', { repeats: 2, retry: 2 }, async ({ task }) => {
  await renderContext(task.context)
  if (task.result?.retryCount !== 2) {
    throw new Error(`failed test at retry count ${task.result?.retryCount}`)
  }
})

test('repeated test retried on later repeat', { repeats: 2, retry: 2 }, async ({ task }) => {
  await renderContext(task.context)
  if (task.result?.repeatCount === 1 && task.result.retryCount !== 1) {
    throw new Error(`failed test at retry count ${task.result?.retryCount}`)
  }
})
