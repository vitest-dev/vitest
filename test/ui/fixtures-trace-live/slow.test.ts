import { test } from 'vitest'
import { page } from 'vitest/browser'

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

test('slow steps', async () => {
  document.body.innerHTML = '<button>Step</button>'
  await page.getByRole('button').mark('before sleep')
  await sleep(2000)
  await page.getByRole('button').mark('after sleep')
})
