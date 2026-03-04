import { trace } from '@opentelemetry/api'
import { test } from 'vitest'

test('other', async () => {
  await new Promise(r => setTimeout(r, 150))
})

test('custom', async () => {
  // this starts span synchronously inside test function,
  // so trace parent works without async context manager (e.g. on browser mode).

  // console.log(context.active())
  // > vitest.test.runner.test.callback
  //   > custom-span

  const tracer = trace.getTracer('custom-scope')
  await tracer.startActiveSpan('custom-span', async (span) => {
    span.setAttribute('custom-attribute', 'hello world')
    await new Promise(resolve => setTimeout(resolve, 50))
    span.end()
  })

  // however the context is dropped on browser mode.
  // console.log(context.active())
})

test.runIf(typeof document !== 'undefined')('browser test', async () => {
  const { page } = await import('vitest/browser')
  document.body.innerHTML = `<button>Hello Vitest</button>`
  await page.getByRole('button', { name: 'Hello Vitest' }).click()
})
