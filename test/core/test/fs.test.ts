import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { timeout } from '../src/timeout'

const content = 'Hello, World!'
const filename = 'fixtures/hi.txt'

describe('fs', () => {
  it('import.meta.dirname', async () => {
    const raw = await fs.readFile(resolve(import.meta.dirname, filename), 'utf-8')

    expect(raw.trim()).toEqual(content)
  })

  it('import.meta.filename', async () => {
    const raw = await fs.readFile(resolve(import.meta.filename, '..', filename), 'utf-8')

    expect(raw.trim()).toEqual(content)
  })

  it('import.meta.url', async () => {
    const raw = await fs.readFile(resolve(fileURLToPath(import.meta.url), '..', filename), 'utf-8')

    expect(raw.trim()).toEqual(content)
  })
})

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout)))
