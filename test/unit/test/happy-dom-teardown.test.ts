import { expect, it, vi } from 'vitest'
import happyDomEnv from '../../../packages/vitest/src/integrations/env/happy-dom.js'

it('teardownVM does not hang when happyDOM.abort schedules a long timer', async () => {
  const vm = await happyDomEnv.setupVM!({} as any)
  const win = vm.getVmContext() as any

  const cancelAsync = vi.spyOn(win.happyDOM, 'cancelAsync')
  vi.spyOn(win.happyDOM, 'abort').mockImplementation(() => new Promise(() => {}))

  const start = Date.now()
  await vm.teardown()
  const elapsed = Date.now() - start

  expect(cancelAsync).toHaveBeenCalled()
  expect(elapsed).toBeLessThan(5000)
})
