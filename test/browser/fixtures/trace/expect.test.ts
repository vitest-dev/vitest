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

test('click fail', async () => {
  document.body.innerHTML = '<button>Hello</button>'
  try {
    // TODO: webdriverio currently records only the lifecycle failure for this case,
    // not the failed action trace entry with selectorResolution: "missing".
    await page.getByRole('button', { name: 'Missing' }).click({ timeout: 100 })
  }
  catch (e) {
    // error messages are different by providers.
    // this is irrelevant since this is a test for action trace metadata
    e.message = 'Click failed (normalized)'
    throw e
  }
})
