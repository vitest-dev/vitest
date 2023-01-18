import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { execa } from 'execa'
import { browserErrors, page, withRetry } from '../setup'

describe('ui', () => {
  const root = resolve(__dirname, '../fixtures')

  it('should load ui', async () => {
    const port = '9527'
    const ui = execa('npx', ['vitest', '--ui', '--api.port', port], {
      cwd: root,
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: 'true',
      },
      stdio: 'inherit',
    })

    ui.catch(e => e)

    await withRetry(async () => {
      await page.goto(`http://localhost:${port}/__vitest__/`)
    })
    expect(await (await page.$('#app'))?.innerHTML()).not.toBe('')
    expect(browserErrors.length).toEqual(0)

    ui.cancel()
  })
})

describe('ui report', () => {
  const root = resolve(__dirname, '../fixtures')
  const port = '9528'

  it('should load ui', async () => {
    // build reporter
    await execa('npx', ['vitest', 'run', '--reporter=html', '--outputFile=html/index.html'], {
      cwd: root,
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: 'true',
      },
      stdio: 'inherit',
    }).catch(e => e)

    // preview report
    const html = execa('npx', ['vite', 'preview', '--outDir', 'html', '--port', port], {
      cwd: root,
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: 'true',
      },
      stdio: 'inherit',
    })

    html.catch(e => e)

    await withRetry(async () => {
      await page.goto(`http://localhost:${port}/__vitest__/`)
    })
    expect(await (await page.$('#app'))?.innerHTML()).not.toBe('')
    expect(browserErrors.length).toEqual(0)

    html.cancel()
  })
})
