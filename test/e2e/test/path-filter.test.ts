import { test } from 'vitest'
import { runVitest } from '../../test-utils'

test('test path is shown when filtering', async () => {
  const { vitest } = await runVitest({
    root: 'fixtures/path-filter',
    watch: true,
  })

  await vitest.waitForStdout('press h to show help, press q to quit')
  vitest.write('t')
  await vitest.waitForStdout(`? Input test name pattern (RegExp)`)
  vitest.write('foo')
  await vitest.waitForStdout('Pattern matches 1 result')
  await vitest.waitForStdout('basic.test.ts > basic path filter > foo')
})
