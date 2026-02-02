import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify as ungapStringify } from '@ungap/structured-clone/json'
import { parse as flattedParse } from 'flatted'

const cwd = dirname(fileURLToPath(import.meta.url))
const input = resolve(cwd, 'fixtures/blob-500-flatted.json')
const output = resolve(cwd, 'fixtures/blob-500-ungap.json')

async function main() {
  const text = await readFile(input, 'utf-8')
  const value = flattedParse(text)
  const serialized = ungapStringify(value)

  await writeFile(output, serialized, 'utf-8')
  console.warn(`wrote ${output}`)
}

void main()
