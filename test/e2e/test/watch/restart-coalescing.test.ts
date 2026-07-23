import { runVitest } from '#test-utils'
import { expect, test } from 'vitest'

// chokidar regularly delivers several change events for one config edit, each
// triggering a restart. A restart that begins while another is still
// re-creating the servers used to report `onServerRestart` to reporters that
// were re-instantiated but not yet initialized, crashing the run with
// "Cannot read properties of undefined (reading 'logger')".
test('concurrent restarts are coalesced instead of overlapping', async () => {
  const { ctx, vitest } = await runVitest({
    root: 'fixtures/watch',
    watch: true,
  })

  const restart = (ctx as any)._restart.bind(ctx)
  await Promise.all([restart('config'), restart('config'), restart('config')])

  expect(vitest.stdout).toContain('Restarting due to config changes')
  expect(vitest.stderr).not.toContain('Cannot read properties')

  // the restarted instance is functional: a rerun still works
  await ctx!.rerunFiles()
  expect(vitest.stdout).toContain('RERUN')
})
