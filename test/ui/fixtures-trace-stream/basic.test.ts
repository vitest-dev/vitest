// import { test } from 'vitest'

// // TODO: range trace
// // - action
// // - expect.element
// // - functional mark

// test('simple', async () => {
//   // document.body.innerHTML = '<button>A</button>'
//   // await page.getByRole('button', { name: 'A' }).click()

//   // await new Promise(r => setTimeout(r, 2000))
//   // document.body.innerHTML += '<button>B</button>'
//   // await page.getByRole('button', { name: 'B' }).click()

//   // await new Promise(r => setTimeout(r, 2000))
//   // document.body.innerHTML += '<button>C</button>'
//   // await page.getByRole('button', { name: 'C' }).click()

//   // await new Promise(r => setTimeout(r, 2000))
//   // document.body.innerHTML += '<button>D</button>'
//   // await page.getByRole('button', { name: 'D' }).click()
// })

import { test, vi } from 'vitest'
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
