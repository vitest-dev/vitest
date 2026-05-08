import { test } from 'vitest'
import { page } from 'vitest/browser'

test('simple', async () => {
  document.body.innerHTML = '<button>A</button>'
  await page.getByRole('button', { name: 'A' }).click()
  await new Promise(r => setTimeout(r, 2000))
  document.body.innerHTML += '<button>B</button>'
  await page.getByRole('button', { name: 'B' }).click()
  await new Promise(r => setTimeout(r, 2000))
  document.body.innerHTML += '<button>C</button>'
  await page.getByRole('button', { name: 'C' }).click()
})
