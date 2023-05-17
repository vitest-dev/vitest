import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import type { File } from 'vitest'
import { startVitest } from 'vitest/node'

test('match by partial pattern', async () => {
  const output = await runVitest('example')

  expect(output).toMatchInlineSnapshot('"pass: test/example.test.ts"')
})

test('match by full test file name', async () => {
  const filename = resolve('./fixtures/test/example.test.ts')
  const output = await runVitest(filename)

  expect(output).toMatchInlineSnapshot('"pass: test/example.test.ts"')
})

test('match by pattern that also matches current working directory', async () => {
  const filter = 'filters'
  expect(process.cwd()).toMatch(filter)

  const output = await runVitest(filter)
  expect(output).toMatchInlineSnapshot('"pass: test/filters.test.ts"')
})

async function runVitest(...cliArgs: string[]) {
  let resolve: (value: string) => void
  const promise = new Promise<string>((_resolve) => {
    resolve = _resolve
  })

  await startVitest('test', cliArgs, {
    root: './fixtures',
    watch: false,
    reporters: [{
      onFinished(files?: File[], errors?: unknown[]) {
        if (errors?.length)
          resolve(`Error: ${JSON.stringify(errors, null, 2)}`)

        if (files)
          resolve(files.map(file => `${file.result?.state}: ${file.name}`).join('\n'))
        else
          resolve('No files')
      },
    }],
  })

  return promise
}
