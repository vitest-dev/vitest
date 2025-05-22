import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { IframeManager } from '../src/client/iframe-manager'
import { FrameLocator } from '../src/client/frame-locator'
import { enhanceBrowserPage } from '../src/client/page-extensions'

describe('EnhancedPage iframe content access', () => {
    let container: HTMLDivElement

    beforeEach(() => {
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        container.remove()
        document.querySelectorAll('iframe').forEach(f => f.remove())
    })

    function createIframe(html: string, attributes: Record<string, string> = {}): Promise<HTMLIFrameElement> {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe')
            iframe.srcdoc = html
            Object.entries(attributes).forEach(([k, v]) => iframe.setAttribute(k, v))

            iframe.addEventListener('load', () => {               
                setTimeout(() => resolve(iframe), 10)
            })

            container.appendChild(iframe)
        })
    }

    test('accesses content via FrameLocator selectors', async () => {
        await createIframe(
            `<button role="button" data-testid="btn" placeholder="Play" alt="Play" title="Play" aria-label="Play">Click me</button><label for="foo">Label</label><input id="foo" />`
        )

        const page = enhanceBrowserPage({} as any)
        const fl = page.frameLocator('iframe')

        expect(fl.getByRole('button')).toBeInstanceOf(FrameLocator)
        expect(fl.getByText('Click me')).toBeInstanceOf(FrameLocator)
        expect(fl.getByTestId('btn')).toBeInstanceOf(FrameLocator)
        expect(fl.getByPlaceholder('Play')).toBeInstanceOf(FrameLocator)
        expect(fl.getByAltText('Play')).toBeInstanceOf(FrameLocator)
        expect(fl.getByTitle('Play')).toBeInstanceOf(FrameLocator)
        expect(fl.getByLabel('Play')).toBeInstanceOf(FrameLocator)
        expect(fl.locator('button')).toBeInstanceOf(FrameLocator)
    })

    test('executes script in iframe context', async () => {
        await createIframe(`<div id="foo">bar</div>`)

        const page = enhanceBrowserPage({} as any)
        const frame = await page.locateFrame({}) 

        const result = await frame.executeScript(() => {
            return document.getElementById('foo')?.textContent
        })

        expect(result).toBe('bar')
    })

    test('executes script with argument', async () => {
        await createIframe(`<div id="foo">bar</div>`)

        const page = enhanceBrowserPage({} as any)
        const frame = await page.locateFrame({})

        const result = await frame.executeScriptWithArgument((id: string) => {
            return document.getElementById(id)?.textContent
        }, 'foo')

        expect(result).toBe('bar')
    })

    test('awaits readyState', async () => {
        await createIframe(`<div>ready</div>`)

        const page = enhanceBrowserPage({} as any)
        const frame = await page.locateFrame({})

        await expect(frame.awaitReadyState()).resolves.toBeUndefined()
    })

    test('checks if frame is active', async () => {
        const iframe = await createIframe(`<span>active</span>`)

        const page = enhanceBrowserPage({} as any)
        const frame = await page.locateFrame({})

        expect(frame.isActive()).toBe(true)
        iframe.remove()
        expect(frame.isActive()).toBe(false)
    })

    test('gets identifier and source', async () => {
        await createIframe(`<div>srcdoc test</div>`, { name: 'frameName' })

        const page = enhanceBrowserPage({} as any)
        const frame = await page.locateFrame({ identifier: 'frameName' })

        expect(frame.getIdentifier()).toBe('frameName')        
        expect(frame.getSource()).toContain('<div>srcdoc test</div>')
    })

    test('captures screenshot throws if not implemented', async () => {
        await createIframe(`<div>no screenshot</div>`)

        const page = enhanceBrowserPage({} as any)
        const frame = await page.locateFrame({})

        await expect(frame.captureScreenshot()).rejects.toThrow(/requires browser provider integration/)
    })

    test('listFrames returns all Frame objects', async () => {
        await createIframe(`<div>one</div>`)
        await createIframe(`<div>two</div>`)

        const page = enhanceBrowserPage({} as any)
        const frames = await page.listFrames()

        expect(Array.isArray(frames)).toBe(true)
        expect(frames.length).toBe(2)
        
        expect(frames[0].getSource()).toContain('<div>one</div>')
        expect(frames[1].getSource()).toContain('<div>two</div>')
    })
})