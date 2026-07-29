import { test } from 'vitest'
import { page } from 'vitest/browser'
import { waitForGate } from './helper'

test('simple', async () => {
  document.body.innerHTML = '<button>A</button>'
  await page.getByRole('button', { name: 'A' }).mark('render-a')

  await waitForGate('b')

  document.body.innerHTML += '<button>B</button>'
  await page.getByRole('button', { name: 'B' }).mark('render-b')

  await waitForGate('c')

  document.body.innerHTML += '<button>C</button>'
  await page.getByRole('button', { name: 'C' }).mark('render-c')
})
