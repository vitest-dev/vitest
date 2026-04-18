import { beforeEach, test, vi } from 'vitest'
import { page } from 'vitest/browser'

beforeEach(() => {
  document.body.innerHTML = ''
})

test('locator.mark', async () => {
  document.body.innerHTML = '<button>Hello</button>'
  await page.getByRole('button').mark('button rendered - locator')
})

test('page.mark', async () => {
  document.body.innerHTML = '<button>Hello</button>'
  await page.mark('button rendered - page')
})

const myRender = vi.defineHelper(async (content: string) => {
  document.body.innerHTML = content
  await page.elementLocator(document.body.firstElementChild!).mark('render helper')
})

test('helper', async () => {
  await myRender('<button>Hello</button>')
})

test('stack', async () => {
  document.body.innerHTML = '<button>Hello</button>'
  const error = new Error('Custom error for stack trace')
  await page.getByRole('button').mark('button rendered - stack', { stack: error.stack })
})

test('mark function', async () => {
  await page.mark('render group', async () => {
    document.body.innerHTML = '<button>Hello</button>'
  })
})
