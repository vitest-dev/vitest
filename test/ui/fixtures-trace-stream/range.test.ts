import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { waitForGate } from './helper'

test('expect', async () => {
  document.body.innerHTML = '<button>A</button>'
  await Promise.all([
    (async () => {
      await expect.element(page.getByRole('button'), { timeout: 10000 }).toHaveTextContent('B')
    })(),
    (async () => {
      await waitForGate('expect-b')
      document.body.innerHTML = '<button>B</button>'
    })(),
  ])
  await Promise.all([
    (async () => {
      await expect.element(page.getByRole('button'), { timeout: 10000 }).toHaveAttribute('data-testid', 'c')
    })(),
    (async () => {
      await waitForGate('expect-c')
      document.body.innerHTML = '<button data-testid="c">C</button>'
    })(),
  ])
})

// TODO: how to test error case?
// test('expect', async () => {
//   document.body.innerHTML = '<button>A</button>'
//   await expect.element(page.getByRole('button'), { timeout: 2000 }).toHaveTextContent('B').catch(() => {})
//   await expect.element(page.getByRole('button'), { timeout: 2000 }).toHaveTextContent('C').catch(() => {})
//   setTimeout(() => {
//     document.body.innerHTML = '<button>D</button>'
//   }, 2000)
//   await expect.element(page.getByRole('button'), { timeout: 4000 }).toHaveTextContent('D')
// })

// test('mark', async () => {
//   document.body.innerHTML = '<button>A</button>'
//   // page.mar
//   // page.getByRole('button', { name: 'B' }).mark(() => {})
//   // page.mark;
//   await page.getByRole('button', { name: 'B' }).click({ timeout: 2000 }).catch(() => {})
//   await page.getByRole('button', { name: 'C' }).click({ timeout: 2000 }).catch(() => {})
// })

// test('action', async () => {
//   document.body.innerHTML = '<button>A</button>'
//   await page.getByRole('button', { name: 'B' }).click({ timeout: 2000 }).catch(() => {})
//   await page.getByRole('button', { name: 'C' }).click({ timeout: 2000 }).catch(() => {})
// })
