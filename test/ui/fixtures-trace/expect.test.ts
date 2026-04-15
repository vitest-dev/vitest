import { beforeEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

beforeEach(() => {
  document.body.innerHTML = ''
})

test('expect.element pass', async () => {
  document.body.innerHTML = '<button>Hello</button>'
  await expect.element(page.getByRole('button')).toHaveTextContent('Hello')
})

test('expect.element fail', async () => {
  document.body.innerHTML = '<button>Hello</button>'
  await expect.element(page.getByRole('button'), { timeout: 100 }).toHaveTextContent('World')
})

test('failure', async () => {
  document.body.innerHTML = '<button>Hello</button>'
  throw new Error('Test failure')
})

test('click', async () => {
  document.body.innerHTML = '<button>Hello</button>'
  await page.getByRole('button').click()
})
