import { expect, test } from 'vitest'
import { execa } from 'execa'

const configs: string[][] = []
const pools = [['--threads', 'true'], ['--threads', 'false'], ['--single-thread']]

if (process.platform !== 'win32')
  pools.push(['--browser'])

for (const isolate of ['true', 'false']) {
  for (const pool of pools) {
    configs.push([
      '--bail',
      '1',
      '--isolate',
      isolate,
      ...pool,
    ])
  }
}

for (const config of configs) {
  test(`should bail with "${config.join(' ')}"`, async () => {
    const { exitCode, stdout } = await execa('vitest', [
      '--no-color',
      '--root',
      'fixtures',
      ...config,
    ], {
      reject: false,
      env: { THREADS: config.join(' ').includes('--threads true') ? 'true' : 'false' },
    })

    expect(exitCode).toBe(1)
    expect(stdout).toMatch('✓ test/first.test.ts > 1 - first.test.ts - this should pass')
    expect(stdout).toMatch('× test/first.test.ts > 2 - first.test.ts - this should fail')

    // Cancelled tests should not be run
    expect(stdout).not.toMatch('test/first.test.ts > 3 - first.test.ts - this should be skipped')
    expect(stdout).not.toMatch('test/second.test.ts > 1 - second.test.ts - this should be skipped')
    expect(stdout).not.toMatch('test/second.test.ts > 2 - second.test.ts - this should be skipped')
    expect(stdout).not.toMatch('test/second.test.ts > 3 - second.test.ts - this should be skipped')
  })
}
