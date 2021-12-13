import { resolve } from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'
import { timeout } from '../src/timeout'

const content = 'Hello, World!'
const filename = 'fixtures/hi.txt'



describe('fs', () => {
  console.log('h')
  process.exit(0)

  it('__dirname', async() => {
  console.log('h 2')
    const raw = await fs.readFile(resolve(__dirname, filename), 'utf-8')

    expect(raw.trim()).toEqual(content)
  })

  it('__filename', async() => {
    const raw = await fs.readFile(resolve(__filename, '..', filename), 'utf-8')

    expect(raw.trim()).toEqual(content)
  })

  it('import.meta.url', async() => {
    // @ts-ignore
    const raw = await fs.readFile(resolve(fileURLToPath(import.meta.url), '..', filename), 'utf-8')

    expect(raw.trim()).toEqual(content)
  })
})

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout)))
