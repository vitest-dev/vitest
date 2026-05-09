import { expect, test, vi } from 'vitest'
import { commands, page } from 'vitest/browser'

// use file system command to communicate with e2e
// to assert trace view is updated incrementally
async function waitForGate(name: string) {
  if (!(import.meta as any).env.TEST_GATE_FILE) {
    await new Promise(r => setTimeout(r, 2000))
    return
  }
  const gatePath = `./node_modules/.vitest-e2e/${name}.txt`
  await vi.waitUntil(async () => {
    try {
      const content = await commands.readFile(gatePath)
      return content.includes('open')
    }
    catch {
      return false
    }
  }, { timeout: 10000 })
}

test('expect', async () => {
  document.body.innerHTML = '<button>A</button>'
  await expect.element(page.getByRole('button'), { timeout: 2000 }).toHaveTextContent('B').catch(() => {})
  await expect.element(page.getByRole('button'), { timeout: 2000 }).toHaveTextContent('C').catch(() => {})
  setTimeout(() => {
    document.body.innerHTML = '<button>D</button>'
  }, 2000)
  await expect.element(page.getByRole('button'), { timeout: 4000 }).toHaveTextContent('D')
})

// test('action', async () => {
//   document.body.innerHTML = '<button>A</button>'
//   await page.getByRole('button', { name: 'B' }).click({ timeout: 2000 }).catch(() => {})
//   await page.getByRole('button', { name: 'C' }).click({ timeout: 2000 }).catch(() => {})
// })
