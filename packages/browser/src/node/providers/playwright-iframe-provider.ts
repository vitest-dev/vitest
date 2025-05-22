import type { FrameLocator as PlaywrightFrameLocator, Page, Frame } from 'playwright'
import type { BrowserCommand } from 'vitest/node'

export interface PlaywrightFrameCommands {
    getFrameLocator: BrowserCommand<[selector: string], PlaywrightFrameLocator>
    getFrame: BrowserCommand<[options: { name?: string; url?: string | RegExp }], Frame | null>
    getAllFrames: BrowserCommand<[], Frame[]>
    executeInFrame: BrowserCommand<[frameSelector: string, action: string, ...args: any[]], any>
    waitForFrame: BrowserCommand<[selector: string, options?: { timeout?: number }], void>
    screenshotFrame: BrowserCommand<[frameSelector: string, options?: any], string>
}

export const playwrightFrameCommands: PlaywrightFrameCommands = {
    getFrameLocator: async (context, selector) => {
        if (context.provider.name !== 'playwright') {
            throw new Error('getFrameLocator is only available with Playwright provider')
        }

        const { iframe } = context
        return iframe.frameLocator(selector)
    },

    getFrame: async (context, options) => {
        if (context.provider.name !== 'playwright') {
            throw new Error('getFrame is only available with Playwright provider')
        }

        const { page } = context

        if (options.name) {
            return page.frame({ name: options.name })
        }

        if (options.url) {
            if (typeof options.url === 'string') {
                return page.frame({ url: options.url })
            } else {
                const frames = page.frames()
                return frames.find(frame => options.url instanceof RegExp && options.url.test(frame.url())) || null
            }
        }

        return null
    },

    getAllFrames: async (context) => {
        if (context.provider.name !== 'playwright') {
            throw new Error('getAllFrames is only available with Playwright provider')
        }

        const { page } = context
        return page.frames()
    },

    executeInFrame: async (context, frameSelector, action, ...args) => {
        if (context.provider.name !== 'playwright') {
            throw new Error('executeInFrame is only available with Playwright provider')
        }

        const { iframe } = context
        const frameLocator = iframe.frameLocator(frameSelector)

        switch (action) {
            case 'click':
                const [clickSelector, clickOptions] = args
                return await frameLocator.locator(clickSelector).click(clickOptions)

            case 'fill':
                const [fillSelector, value, fillOptions] = args
                return await frameLocator.locator(fillSelector).fill(value, fillOptions)

            case 'getText':
                const [textSelector] = args
                return await frameLocator.locator(textSelector).textContent()

            case 'isVisible':
                const [visibleSelector] = args
                return await frameLocator.locator(visibleSelector).isVisible()

            case 'waitFor':
                const [waitSelector, waitOptions] = args
                return await frameLocator.locator(waitSelector).waitFor(waitOptions)

            default:
                throw new Error(`Unknown action: ${action}`)
        }
    },

    waitForFrame: async (context, selector, options = {}) => {
        if (context.provider.name !== 'playwright') {
            throw new Error('waitForFrame is only available with Playwright provider')
        }

        const { iframe } = context
        const { timeout = 30000 } = options

        await iframe.locator(selector).waitFor({ timeout })

        const frameLocator = iframe.frameLocator(selector)
        await frameLocator.locator('body').waitFor({ timeout })
    },

    screenshotFrame: async (context, frameSelector, options = {}) => {
        if (context.provider.name !== 'playwright') {
            throw new Error('screenshotFrame is only available with Playwright provider')
        }

        const { iframe } = context
        const frameLocator = iframe.frameLocator(frameSelector)

        const screenshot = await frameLocator.locator('body').screenshot(options)

        if (options.path) {
            return options.path
        }

        return screenshot.toString('base64')
    }
}

export const playwrightFrameUtils = {
    createFrameBridge: (frameSelector: string) => {
        return {
            async click(selector: string, options?: any) {
                const { commands } = await import('@vitest/browser/context')
                return commands.executeInFrame(frameSelector, 'click', selector, options)
            },

            async fill(selector: string, value: string, options?: any) {
                const { commands } = await import('@vitest/browser/context')
                return commands.executeInFrame(frameSelector, 'fill', selector, value, options)
            },

            async getText(selector: string) {
                const { commands } = await import('@vitest/browser/context')
                return commands.executeInFrame(frameSelector, 'getText', selector)
            },

            async isVisible(selector: string) {
                const { commands } = await import('@vitest/browser/context')
                return commands.executeInFrame(frameSelector, 'isVisible', selector)
            },

            async waitFor(selector: string, options?: any) {
                const { commands } = await import('@vitest/browser/context')
                return commands.executeInFrame(frameSelector, 'waitFor', selector, options)
            },

            async screenshot(options?: any) {
                const { commands } = await import('@vitest/browser/context')
                return commands.screenshotFrame(frameSelector, options)
            }
        }
    }
}

export function vitestPlaywrightFramePlugin() {
    return {
        name: 'vitest:playwright-frame',
        config(config: any) {
            config.test = config.test || {}
            config.test.browser = config.test.browser || {}
            config.test.browser.commands = {
                ...config.test.browser.commands,
                ...playwrightFrameCommands
            }
        }
    }
}