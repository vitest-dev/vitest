import { describe, expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

const fixturePath = './fixtures/location-filters'

describe('location filter with list command', () => {
  test('finds test at correct line number', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:5`,
    )

    expect(stdout).toMatchInlineSnapshot(`
      "basic.test.ts > basic suite > inner suite > some test
      "
    `)
    expect(stderr).toEqual('')
  })

  test('finds "basic suite" at correct line number', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:3`,
    )

    expect(stdout).toMatchInlineSnapshot(`
      "basic.test.ts > basic suite > inner suite > some test
      basic.test.ts > basic suite > inner suite > another test
      basic.test.ts > basic suite > basic test
      "
    `)
    expect(stderr).toEqual('')
  })

  test('finds "inner suite" at correct line number', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:4`,
    )

    expect(stdout).toMatchInlineSnapshot(`
      "basic.test.ts > basic suite > inner suite > some test
      basic.test.ts > basic suite > inner suite > another test
      "
    `)
    expect(stderr).toEqual('')
  })

  test('handles matching test inside a suite', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:3`,
      `${fixturePath}/basic.test.ts:9`,
    )

    expect(stdout).toMatchInlineSnapshot(`
      "basic.test.ts > basic suite > inner suite > some test
      basic.test.ts > basic suite > inner suite > another test
      basic.test.ts > basic suite > basic test
      "
    `)
    expect(stderr).toEqual('')
  })

  test('handles file with a dash in the name', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      `-r=${fixturePath}`,
      `${fixturePath}/math-with-dashes-in-name.test.ts:3`,
    )

    expect(stdout).toMatchInlineSnapshot(`
      "math-with-dashes-in-name.test.ts > 1 plus 1
      "
    `)
    expect(stderr).toEqual('')
  })

  test('reports not found test', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:99`,
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
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:5`,
      `${fixturePath}/basic.test.ts:12`,
      `${fixturePath}/basic.test.ts:99`,
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
      `-r=${fixturePath}`,
      `${fixturePath}/a/file/that/doesnt/exit:10-15`,
    )

    expect(stdout).toEqual('')
    expect(stderr).toContain('Collect Error')
    expect(stderr).toContain('RangeLocationFilterProvidedError')
  })

  test('parses file with a colon and dash in the name correctly', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      `-r=${fixturePath}`,
      `${fixturePath}/:a/file/that/doesn-t/exit:10`,
    )

    expect(stdout).toEqual('')
    // shouldn't get a range location error
    expect(stderr).not.toContain('Error: Found "-"')
  })

  test('fails on part of filename with location filter', async () => {
    const { stdout, stderr } = await runVitestCli(
      'list',
      `-r=${fixturePath}`,
      `math:999`,
    )

    expect(stdout).toEqual('')
    expect(stderr).toContain('Collect Error')
    expect(stderr).toContain('LocationFilterFileNotFoundError')
  })
})

describe('location filter with run command', () => {
  test('finds test at correct line number', async () => {
    const { stdout, stderr } = await runVitestCli(
      'run',
      `-r=${fixturePath}`,
      `${fixturePath}/math.test.ts:3`,
    )

    expect(stdout).contain('1 passed')
    expect(stdout).contain('1 skipped')
    expect(stderr).toEqual('')
  })

  test('finds "basic suite" at correct line number', async () => {
    const { stdout, stderr } = await runVitestCli(
      'run',
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:3`,
    )

    expect(stdout).contain('3 passed')
    expect(stdout).contain('1 skipped')
    expect(stderr).toEqual('')
  })

  test('finds "inner suite" at correct line number', async () => {
    const { stdout, stderr } = await runVitestCli(
      'run',
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:4`,
    )

    expect(stdout).contain('2 passed')
    expect(stdout).contain('2 skipped')
    expect(stderr).toEqual('')
  })

  test('handles matching test inside a suite', async () => {
    const { stdout, stderr } = await runVitestCli(
      'run',
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:3`,
      `${fixturePath}/basic.test.ts:9`,
    )

    expect(stdout).contain('3 passed')
    expect(stdout).contain('1 skipped')
    expect(stderr).toEqual('')
  })

  test('handles file with a dash in the name', async () => {
    const { stdout, stderr } = await runVitestCli(
      'run',
      `-r=${fixturePath}`,
      `${fixturePath}/math-with-dashes-in-name.test.ts:3`,
    )

    expect(stdout).contain('1 passed')
    expect(stdout).contain('1 skipped')
    expect(stderr).toEqual('')
  })

  test('reports not found test', async () => {
    const { stdout, stderr } = await runVitestCli(
      'run',
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:99`,
    )

    expect(stdout).toContain('4 skipped')
    expect(stderr).toContain('Error: No test found in basic.test.ts in line 99')
  })

  test('reports multiple not found tests', async () => {
    const { stdout, stderr } = await runVitestCli(
      'run',
      `-r=${fixturePath}`,
      `${fixturePath}/basic.test.ts:5`,
      `${fixturePath}/basic.test.ts:12`,
      `${fixturePath}/basic.test.ts:99`,
    )

    expect(stdout).toContain('4 skipped')
    expect(stderr).toContain('Error: No test found in basic.test.ts in lines 12, 99')
  })

  test('errors if range location is provided', async () => {
    const { stderr } = await runVitestCli(
      'run',
      `-r=${fixturePath}`,
      `${fixturePath}/a/file/that/doesnt/exit:10-15`,
    )

    expect(stderr).toContain('Error: Found "-"')
  })

  test('parses file with a colon and dash in the name correctly', async () => {
    const { stderr } = await runVitestCli(
      'run',
      `-r=${fixturePath}`,
      `${fixturePath}/:a/file/that/doesn-t/exit:10`,
    )

    // shouldn't get a range location error
    expect(stderr).not.toContain('Error: Found "-"')
  })

  test('fails on part of filename with location filter', async () => {
    const { stdout, stderr } = await runVitestCli(
      'run',
      `-r=${fixturePath}`,
      `math:999`,
    )

    expect(stdout).not.contain('math.test.ts')
    expect(stdout).not.contain('math-with-dashes-in-name.test.ts')
    expect(stderr).toMatchInlineSnapshot(`
      "Error: Couldn't find file math. Note when specifying the test location you have to specify the full test filename.
      "
    `)
  })
})
