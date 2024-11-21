import { describe, expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

describe('location filter with list command', () => {
  test('finds test at correct line number', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      '-r=./fixtures/location-filters',
      '--config=custom.config.ts',
      'basic.test.ts:5',
    )

    expect(stdout).toMatchInlineSnapshot(`
      "[custom] basic.test.ts > basic suite > inner suite > some test
      "
    `)
    expect(stderr).toEqual('')
  })

  test('reports not found test', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      '-r=./fixtures/location-filters',
      '--config=custom.config.ts',
      'basic.test.ts:99',
    )

    expect(stdout).toEqual('')
    expect(stderr).toMatchInlineSnapshot(`
      "Error: No test found in basic.test.ts in line 99
      "
    `)
  })

  test('reports multiple not found tests', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      '-r=./fixtures/location-filters',
      '--config=custom.config.ts',
      'basic.test.ts:5',
      'basic.test.ts:12',
      'basic.test.ts:99',
    )

    expect(stdout).toEqual('')
    expect(stderr).toMatchInlineSnapshot(`
      "Error: No test found in basic.test.ts in lines 12, 99
      "
    `)
  })

  test('errors if range location is provided', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      '-r=./fixtures/location-filters',
      'a/file/that/doesnt/exit:10-15',
    )

    expect(stdout).toEqual('')
    expect(stderr).toContain('Collect Error')
    expect(stderr).toContain('RangeLocationFilterProvidedError')
  })

  test('erorrs if includeTaskLocation is not enabled', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      '-r=./fixtures/location-filters',
      '--config=no-task-location.config.ts',
      'a/file/that/doesnt/exist:5',
    )

    expect(stdout).toEqual('')
    expect(stderr).toContain('Collect Error')
    expect(stderr).toContain('IncludeTaskLocationDisabledError')
  })
})

// describe('location filter with run command', () => {
//   test('finds test at correct line number', async () => {
//     const { stdout, stderr } = await runVitestCli(
//       'run',
//       '-r=./fixtures/location-filters',
//       '--config=vitest.config.ts',
//       'basic.test.ts:6',
//       // 'basic.test.ts:15',
//       // 'math.test.ts:3',
//     )
//
//     expect(`${stdout} ${stderr}`).toEqual('')
//
//     expect(stdout).toMatchInlineSnapshot(`
//       "[custom] basic.test.ts > basic suite > inner suite > some test
//       "
//     `)
//     expect(stderr).toEqual('')
//   })
//
//   // test('reports not found test', async () => {
//   //   const { stdout, stderr } = await runVitestCli(
//   //     'list',
//   //     '-r=./fixtures/location-filters',
//   //     '--config=custom.config.ts',
//   //     'basic.test.ts:99',
//   //   )
//   //
//   //   expect(stdout).toEqual('')
//   //   expect(stderr).toMatchInlineSnapshot(`
//   //     "Error: No test found in basic.test.ts in line 99
//   //     "
//   //   `)
//   // })
//   //
//   // test('reports multiple not found tests', async () => {
//   //   const { stdout, stderr } = await runVitestCli(
//   //     'list',
//   //     '-r=./fixtures/location-filters',
//   //     '--config=custom.config.ts',
//   //     'basic.test.ts:5',
//   //     'basic.test.ts:12',
//   //     'basic.test.ts:99',
//   //   )
//   //
//   //   expect(stdout).toEqual('')
//   //   expect(stderr).toMatchInlineSnapshot(`
//   //     "Error: No test found in basic.test.ts in lines 12, 99
//   //     "
//   //   `)
//   // })
//   //
//   // test('errors if range location is provided', async () => {
//   //   const { stdout, stderr } = await runVitestCli(
//   //     'list',
//   //     '-r=./fixtures/location-filters',
//   //     'a/file/that/doesnt/exit:10-15',
//   //   )
//   //
//   //   expect(stdout).toEqual('')
//   //   expect(stderr).toContain('Collect Error')
//   //   expect(stderr).toContain('RangeLocationFilterProvidedError')
//   // })
//   //
//   // test('erorrs if includeTaskLocation is not enabled', async () => {
//   //   const { stdout, stderr } = await runVitestCli(
//   //     'list',
//   //     '-r=./fixtures/location-filters',
//   //     '--config=no-task-location.config.ts',
//   //     'a/file/that/doesnt/exist:5',
//   //   )
//   //
//   //   expect(stdout).toEqual('')
//   //   expect(stderr).toContain('Collect Error')
//   //   expect(stderr).toContain('IncludeTaskLocationDisabledError')
//   // })
// })
