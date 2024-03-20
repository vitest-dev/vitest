import fs from 'node:fs'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('compare', { timeout: 60_000 }, async () => {
  await fs.promises.rm('./fixtures/basic/bench.json', { force: true })

  // force tty output
  process.stdout.isTTY = true

  {
    const result = await runVitest({
      root: './fixtures/basic',
      outputFile: './bench.json',
      reporters: ['default'],
    }, [], 'benchmark')
    expect(result.exitCode).toBe(0)
    expect(fs.existsSync('./fixtures/basic/bench.json')).toBe(true)
  }

  // --compare
  {
    const result = await runVitest({
      root: './fixtures/basic',
      compare: './bench.json',
      reporters: ['default'],
    }, [], 'benchmark')
    expect(result.exitCode).toBe(0)

    // assert a few lines after "✓ suite" in a following output
    //
    //   ✓ basic.bench.ts (2) 830ms
    //     ✓ suite (2) 829ms
    //       name             hz      min      max     mean      p75      p99     p995     p999     rme  samples
    //     · sleep(10)   98.5536  10.1310  10.1625  10.1468  10.1625  10.1625  10.1625  10.1625  ±1.97%        2  [1.00x] ⇓
    //                   98.6277  10.1212  10.1571  10.1391  10.1571  10.1571  10.1571  10.1571  ±2.25%        -  (baseline)
    //     · sleep(100)   9.9755   100.23   100.26   100.25   100.26   100.26   100.26   100.26  ±0.19%        2  [1.00x] ⇓
    //                    9.9816   100.17   100.20   100.18   100.20   100.20   100.20   100.20  ±0.15%        -  (baseline)

    const lines = result.stdout.split('✓ suite')[1].split('\n').slice(1, 6)
    expect(lines).toMatchObject([
      expect.stringMatching(/name/),
      expect.stringMatching(/sleep.*(⇑|⇓)/),
      expect.stringMatching(/baseline/),
      expect.stringMatching(/sleep.*(⇑|⇓)/),
      expect.stringMatching(/baseline/),
    ])
  }
})
