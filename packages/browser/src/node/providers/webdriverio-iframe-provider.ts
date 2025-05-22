// packages/browser/src/node/providers/webdriverio-iframe-provider.ts

import type { Browser, Element } from 'webdriverio'
import type { BrowserCommand } from 'vitest/node'

export interface WebdriverIOFrameCommands {
    switchToFrame: BrowserCommand<[selector: string], void>
    switchToParentFrame: BrowserCommand<[], void>
    executeInFrame: BrowserCommand<[frameSelector: string, action: () => Promise<any>], any>
    getElementInFrame: BrowserCommand<[frameSelector: string, elementSelector: string], Element>
    isFrameAvailable: BrowserCommand<[selector: string], boolean>
    waitForFrameReady: BrowserCommand<[selector: string, options?: { timeout?: number }], void>
    getFrameElementText: BrowserCommand<[frameSelector: string, elementSelector: string], string>
    screenshotFrame: BrowserCommand<[frameSelector: string, options?: any], string>
}

export const webdriverIOFrameCommands: WebdriverIOFrameCommands = {
    switchToFrame: async (context, selector) => {
        if (context.provider.name !== 'webdriverio') {
            throw new Error('switchToFrame is only available with WebdriverIO provider')
        }

        const { browser } = context
        const frameElement = await browser.$(selector)

        if (!await frameElement.isExisting()) {
            throw new Error(`Frame with selector "${selector}" not found`)
        }

        await browser.switchToFrame(frameElement)
    },

    switchToParentFrame: async (context) => {
        if (context.provider.name !== 'webdriverio') {
            throw new Error('switchToParentFrame is only available with WebdriverIO provider')
        }

        const { browser } = context
        await browser.switchToParentFrame()
    },

    executeInFrame: async (context, frameSelector, action) => {
        if (context.provider.name !== 'webdriverio') {
            throw new Error('executeInFrame is only available with WebdriverIO provider')
        }

        const { browser } = context

        try {
            const frameElement = await browser.$(frameSelector)
            if (!await frameElement.isExisting()) {
                throw new Error(`Frame with selector "${frameSelector}" not found`)
            }

            await browser.switchToFrame(frameElement)
            const result = await action()
            return result
        } finally {
            await browser.switchToParentFrame()
        }
    },

    getElementInFrame: async (context, frameSelector, elementSelector) => {
        if (context.provider.name !== 'webdriverio') {
            throw new Error('getElementInFrame is only available with WebdriverIO provider')
        }

        const { browser } = context

        try {
            const frameElement = await browser.$(frameSelector)
            if (!await frameElement.isExisting()) {
                throw new Error(`Frame with selector "${frameSelector}" not found`)
            }

            await browser.switchToFrame(frameElement)
            const element = await browser.$(elementSelector)
            return element
        } finally {
            await browser.switchToParentFrame()
        }
    },

    isFrameAvailable: async (context, selector) => {
        if (context.provider.name !== 'webdriverio') {
            throw new Error('isFrameAvailable is only available with WebdriverIO provider')
        }

        const { browser } = context

        try {
            const frameElement = await browser.$(selector)

            if (!await frameElement.isExisting()) {
                return false
            }

            await browser.switchToFrame(frameElement)
            return true
        } catch {
            return false
        } finally {
            try {
                await browser.switchToParentFrame()
            } catch {
                // Ignore error if already in main context
            }
        }
    },

    waitForFrameReady: async (context, selector, options = {}) => {
        if (context.provider.name !== 'webdriverio') {
            throw new Error('waitForFrameReady is only available with WebdriverIO provider')
        }

        const { browser } = context
        const { timeout = 30000 } = options

        const frameElement = await browser.$(selector)
        await frameElement.waitForExist({ timeout })

        await browser.waitUntil(
            async () => {
                try {
                    await browser.switchToFrame(frameElement)
                    await browser.switchToParentFrame()
                    return true
                } catch {
                    return false
                }
            },
            {
                timeout,
                timeoutMsg: `Frame "${selector}" was not ready within ${timeout}ms`
            }
        )
    },

    getFrameElementText: async (context, frameSelector, elementSelector) => {
        if (context.provider.name !== 'webdriverio') {
            throw new Error('getFrameElementText is only available with WebdriverIO provider')
        }

        const { browser } = context

        try {
            const frameElement = await browser.$(frameSelector)
            if (!await frameElement.isExisting()) {
                throw new Error(`Frame with selector "${frameSelector}" not found`)
            }

            await browser.switchToFrame(frameElement)

            const element = await browser.$(elementSelector)
            if (!await element.isExisting()) {
                throw new Error(`Element with selector "${elementSelector}" not found in frame`)
            }

            const text = await element.getText()
            return text
        } finally {
            await browser.switchToParentFrame()
        }
    },

    screenshotFrame: async (context, frameSelector, options = {}) => {
        if (context.provider.name !== 'webdriverio') {
            throw new Error('screenshotFrame is only available with WebdriverIO provider')
        }

        const { browser } = context

        try {
            const frameElement = await browser.$(frameSelector)
            if (!await frameElement.isExisting()) {
                throw new Error(`Frame with selector "${frameSelector}" not found`)
            }

            await browser.switchToFrame(frameElement)

            const bodyElement = await browser.$('body')
            const screenshot = await bodyElement.saveScreenshot(options)
            return screenshot
        } finally {
            await browser.switchToParentFrame()
        }
    }
}

export class WebdriverIOFrameHelper {
    private browser: Browser
    private currentFrame: string | null = null

    constructor(browser: Browser) {
        this.browser = browser
    }

    async withinFrame<T>(frameSelector: string, actions: () => Promise<T>): Promise<T> {
        const wasInFrame = this.currentFrame !== null

        try {
            if (this.currentFrame !== frameSelector) {
                if (this.currentFrame) {
                    await this.browser.switchToParentFrame()
                }

                const frameElement = await this.browser.$(frameSelector)
                if (!await frameElement.isExisting()) {
                    throw new Error(`Frame with selector "${frameSelector}" not found`)
                }

                await this.browser.switchToFrame(frameElement)
                this.currentFrame = frameSelector
            }

            return await actions()
        } finally {
            if (!wasInFrame && this.currentFrame) {
                await this.browser.switchToParentFrame()
                this.currentFrame = null
            }
        }
    }

    async reset(): Promise<void> {
        if (this.currentFrame) {
            await this.browser.switchToParentFrame()
            this.currentFrame = null
        }
    }

    isInFrame(): boolean {
        return this.currentFrame !== null
    }

    getCurrentFrame(): string | null {
        return this.currentFrame
    }
}

export const webdriverIOFrameUtils = {
    createFrameWrapper: (frameSelector: string) => {
        return {
            async click(elementSelector: string, options?: any) {
                const { commands } = await import('@vitest/browser/context')
                return commands.executeInFrame(frameSelector, async () => {
                    const { browser } = await import('@vitest/browser/context')
                    const element = await browser.$(elementSelector)
                    return element.click(options)
                })
            },

            async fill(elementSelector: string, value: string) {
                const { commands } = await import('@vitest/browser/context')
                return commands.executeInFrame(frameSelector, async () => {
                    const { browser } = await import('@vitest/browser/context')
                    const element = await browser.$(elementSelector)
                    return element.setValue(value)
                })
            },

            async getText(elementSelector: string) {
                const { commands } = await import('@vitest/browser/context')
                return commands.getFrameElementText(frameSelector, elementSelector)
            },

            async isVisible(elementSelector: string) {
                const { commands } = await import('@vitest/browser/context')
                return commands.executeInFrame(frameSelector, async () => {
                    const { browser } = await import('@vitest/browser/context')
                    const element = await browser.$(elementSelector)
                    return element.isDisplayed()
                })
            },

            async waitFor(elementSelector: string, options?: any) {
                const { commands } = await import('@vitest/browser/context')
                return commands.executeInFrame(frameSelector, async () => {
                    const { browser } = await import('@vitest/browser/context')
                    const element = await browser.$(elementSelector)
                    return element.waitForExist(options)
                })
            }
        }
    }
}

export function vitestWebdriverIOFramePlugin() {
    return {
        name: 'vitest:webdriverio-frame',
        config(config: any) {
            config.test = config.test || {}
            config.test.browser = config.test.browser || {}
            config.test.browser.commands = {
                ...config.test.browser.commands,
                ...webdriverIOFrameCommands
            }
        }
    }
}