import fs from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const dir = join(import.meta.dirname, '../test-update')
const dirents = await fs.readdir(dir, { withFileTypes: true })
const files = dirents.filter(f => f.isFile()).map(f => f.name)
test.for(files)('%s', async (file) => {
  const content = await fs.readFile(join(dir, file), 'utf8')
  expect(content).toMatchSnapshot()
})
