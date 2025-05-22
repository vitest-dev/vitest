import type { BrowserPage } from '../types'
import { IframeManager } from './iframe-manager'
import { FrameLocator } from './frame-locator'

interface FrameCriteria {
    identifier?: string
    urlPattern?: string | RegExp
}

interface EnhancedPage extends BrowserPage {
    createFrameContext(selector: string, parameters?: { timeout?: number }): FrameLocator
    locateFrame(criteria: FrameCriteria): Promise<Frame>
    listFrames(): Promise<Frame[]>
}

interface Frame {
    getIdentifier(): string | null
    getSource(): string
    isActive(): boolean
    findElementByRole(role: string, parameters?: object): FrameLocator
    findElementByText(content: string | RegExp, parameters?: object): FrameLocator
    findElementByTestId(identifier: string | RegExp): FrameLocator
    findElementByPlaceholder(content: string | RegExp, parameters?: object): FrameLocator
    findElementByAltText(content: string | RegExp, parameters?: object): FrameLocator
    findElementByTitle(content: string | RegExp, parameters?: object): FrameLocator
    findElementByLabel(content: string | RegExp, parameters?: object): FrameLocator
    querySelector(selector: string): FrameLocator
    executeScript<T>(operation: () => T): Promise<T>
    executeScriptWithArgument<T, A>(operation: (arg: A) => T, argument: A): Promise<T>
    awaitReadyState(state?: 'load' | 'domcontentloaded' | 'networkidle'): Promise<void>
    captureScreenshot(parameters?: { path?: string; quality?: number }): Promise<string>
}

class FrameImplementation implements Frame {
    private frameManager: IframeManager
    private frameIdentifier: string
    private frameElement: HTMLIFrameElement

    constructor(frameManager: IframeManager, identifier: string, element: HTMLIFrameElement) {
        this.frameManager = frameManager
        this.frameIdentifier = identifier
        this.frameElement = element
    }

    getIdentifier(): string | null {
        return this.frameElement.name || null
    }

    getSource(): string {
        return this.frameElement.src || this.frameElement.getAttribute('srcdoc') || ''
    }

    isActive(): boolean {
        return document.contains(this.frameElement)
    }

    findElementByRole(role: string, parameters?: object): FrameLocator {
        return this.generateLocator(`[role="${role}"]`, parameters)
    }

    findElementByText(content: string | RegExp, parameters?: object): FrameLocator {
        return this.generateLocator(this.createTextSelector(content), parameters)
    }

    findElementByTestId(identifier: string | RegExp): FrameLocator {
        return this.generateLocator(this.createTestIdSelector(identifier))
    }

    findElementByPlaceholder(content: string | RegExp, parameters?: object): FrameLocator {
        return this.generateLocator(this.createPlaceholderSelector(content), parameters)
    }

    findElementByAltText(content: string | RegExp, parameters?: object): FrameLocator {
        return this.generateLocator(this.createAltTextSelector(content), parameters)
    }

    findElementByTitle(content: string | RegExp, parameters?: object): FrameLocator {
        return this.generateLocator(this.createTitleSelector(content), parameters)
    }

    findElementByLabel(content: string | RegExp, parameters?: object): FrameLocator {
        return this.generateLocator(this.createLabelSelector(content), parameters)
    }

    querySelector(selector: string): FrameLocator {
        return this.generateLocator(selector)
    }

    async executeScript<T>(operation: () => T): Promise<T> {
        return this.evaluateScript(operation)
    }

    async executeScriptWithArgument<T, A>(operation: (arg: A) => T, argument: A): Promise<T> {
        return this.evaluateScript(operation, argument)
    }

    async awaitReadyState(state: 'load' | 'domcontentloaded' | 'networkidle' = 'load'): Promise<void> {
        return new Promise(resolve => {
            if (state === 'load' && this.frameElement.complete) {
                return resolve()
            }

            const readyCheck = () => {
                if (this.frameElement.contentDocument?.readyState === 'complete') {
                    resolve()
                } else {
                    setTimeout(readyCheck, 10)
                }
            }

            this.frameElement.addEventListener(state, () => resolve(), { once: true })
            setTimeout(readyCheck, 0)
        })
    }

    async captureScreenshot(): Promise<string> {
        throw new Error('Frame screenshot capability requires browser provider integration')
    }

    private generateLocator(selector: string, parameters?: object): FrameLocator {
        const frameSelector = `iframe[data-frame-id="${this.frameIdentifier}"]`
        return new FrameLocator(this.frameManager, frameSelector, parameters)
    }

    private async evaluateScript<T>(operation: Function, argument?: any): Promise<T> {
        const frame = await this.frameManager.verifyFrameReady(this.frameIdentifier)

        if (!frame.contentWindow) {
            throw new Error('Frame execution context unavailable')
        }

        try {
            return argument !== undefined ?
                frame.contentWindow.eval(`(${operation.toString()})(${JSON.stringify(argument)})`) :
                frame.contentWindow.eval(`(${operation.toString()})()`)
        } catch (error) {
            throw new Error(`Frame script execution failed: ${error}`)
        }
    }

    private createTextSelector(content: string | RegExp): string {
        return `*[contains(text(), '${content instanceof RegExp ? content.source : content}')]`
    }

    private createTestIdSelector(identifier: string | RegExp): string {
        return `[data-testid${identifier instanceof RegExp ? '*' : ''}="${identifier instanceof RegExp ? identifier.source : identifier}"]`
    }

    private createPlaceholderSelector(content: string | RegExp): string {
        return `[placeholder${content instanceof RegExp ? '*' : ''}="${content instanceof RegExp ? content.source : content}"]`
    }

    private createAltTextSelector(content: string | RegExp): string {
        return `[alt${content instanceof RegExp ? '*' : ''}="${content instanceof RegExp ? content.source : content}"]`
    }

    private createTitleSelector(content: string | RegExp): string {
        return `[title${content instanceof RegExp ? '*' : ''}="${content instanceof RegExp ? content.source : content}"]`
    }

    private createLabelSelector(content: string | RegExp): string {
        const matchType = content instanceof RegExp ? '*=' : '='
        const value = content instanceof RegExp ? content.source : content
        return `input[aria-label${matchType}"${value}"], textarea[aria-label${matchType}"${value}"], select[aria-label${matchType}"${value}"]`
    }
}

export function enhanceBrowserPage(basePage: BrowserPage): EnhancedPage {
    const frameManager = new FrameManager()

    function buildFrameSelector(criteria: FrameCriteria): string {
        const selectors = ['iframe']
        if (criteria.identifier) selectors.push(`[name="${criteria.identifier}"]`)
        if (typeof criteria.urlPattern === 'string') selectors.push(`[src="${criteria.urlPattern}"]`)
        return selectors.join('')
    }

    function registerFrameElement(element: HTMLIFrameElement): Frame {
        const identifier = frameManager.registerFrame(element)
        return new FrameImplementation(frameManager, identifier, element)
    }

    return {
        ...basePage,

        createFrameContext(selector: string, parameters = {}): FrameLocator {
            return new FrameLocator(frameManager, selector, parameters)
        },

        async locateFrame(criteria: FrameCriteria): Promise<Frame> {
            const frameQuery = buildFrameSelector(criteria)
            const targetFrame = document.querySelector(frameQuery) as HTMLIFrameElement

            if (!targetFrame) {
                const errorMessage = criteria.urlPattern instanceof RegExp ?
                    `No frame matching URL pattern: ${criteria.urlPattern}` :
                    `Frame not found: ${frameQuery}`
                throw new Error(errorMessage)
            }

            return registerFrameElement(targetFrame)
        },

        async listFrames(): Promise<Frame[]> {
            return Array.from(document.querySelectorAll('iframe'))
                .map(frame => registerFrameElement(frame as HTMLIFrameElement))
        },
    }
}