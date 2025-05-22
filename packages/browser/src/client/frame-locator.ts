import type { Locator, LocatorOptions, LocatorByRoleOptions, ARIARole } from '../types'
import { IframeManager } from './iframe-manager'

interface FrameLocatorOptions {
    timeout?: number
    waitForReady?: boolean
}

export class FrameLocator {
    private iframeManager: IframeManager
    private frameSelector: string
    private options: FrameLocatorOptions

    constructor(
        iframeManager: IframeManager,
        frameSelector: string,
        options: FrameLocatorOptions = {}
    ) {
        this.iframeManager = iframeManager
        this.frameSelector = frameSelector
        this.options = {
            timeout: 30000,
            waitForReady: true,
            ...options
        }
    }

    getByRole(role: ARIARole | string, options?: LocatorByRoleOptions): Locator {
        return this.generateLocator(`[role="${role}"]`, options)
    }

    getByText(text: string | RegExp, options?: LocatorOptions): Locator {
        return this.generateLocator(this.textToSelector(text), options)
    }

    getByTestId(testId: string | RegExp): Locator {
        return this.generateLocator(this.testIdToSelector(testId))
    }

    getByPlaceholder(text: string | RegExp, options?: LocatorOptions): Locator {
        return this.generateLocator(this.placeholderToSelector(text), options)
    }

    getByAltText(text: string | RegExp, options?: LocatorOptions): Locator {
        return this.generateLocator(this.altTextToSelector(text), options)
    }

    getByTitle(text: string | RegExp, options?: LocatorOptions): Locator {
        return this.generateLocator(this.titleToSelector(text), options)
    }

    getByLabelText(text: string | RegExp, options?: LocatorOptions): Locator {
        return this.generateLocator(this.labelToSelector(text), options)
    }

    locator(selector: string): Locator {
        return this.generateLocator(selector)
    }

    private generateLocator(selector: string, options?: any): Locator {
        return new FrameLocatorImplementation(
            this.iframeManager,
            this.frameSelector,
            selector,
            { ...this.options, ...options }
        )
    }

    private textToSelector(text: string | RegExp): string {
        return `*[contains(text(), '${text instanceof RegExp ? text.source : text}')]`
    }

    private testIdToSelector(testId: string | RegExp): string {
        return `[data-testid${testId instanceof RegExp ? '*' : ''}="${testId instanceof RegExp ? testId.source : testId}"]`
    }

    private placeholderToSelector(text: string | RegExp): string {
        return `[placeholder${text instanceof RegExp ? '*' : ''}="${text instanceof RegExp ? text.source : text}"]`
    }

    private altTextToSelector(text: string | RegExp): string {
        return `[alt${text instanceof RegExp ? '*' : ''}="${text instanceof RegExp ? text.source : text}"]`
    }

    private titleToSelector(text: string | RegExp): string {
        return `[title${text instanceof RegExp ? '*' : ''}="${text instanceof RegExp ? text.source : text}"]`
    }

    private labelToSelector(text: string | RegExp): string {
        const target = text instanceof RegExp ? `*="${text.source}"` : `="${text}"`
        return `input[aria-label${target}], textarea[aria-label${target}], select[aria-label${target}]`
    }
}

class FrameLocatorImplementation implements Locator {
    private iframeManager: IframeManager
    private frameSelector: string
    private elementSelector: string
    private options: FrameLocatorOptions

    constructor(
        iframeManager: IframeManager,
        frameSelector: string,
        elementSelector: string,
        options: FrameLocatorOptions
    ) {
        this.iframeManager = iframeManager
        this.frameSelector = frameSelector
        this.elementSelector = elementSelector
        this.options = options
    }

    get selector(): string {
        return `${this.frameSelector} >>> ${this.elementSelector}`
    }

    async click(options?: any): Promise<void> {
        const element = await this.retrieveElement()
        element?.click()
    }

    async fill(value: string, options?: any): Promise<void> {
        const element = await this.retrieveElement()
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.value = value
            element.dispatchEvent(new Event('input', { bubbles: true }))
            element.dispatchEvent(new Event('change', { bubbles: true }))
        }
    }

    async hover(options?: any): Promise<void> {
        const element = await this.retrieveElement()
        element?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
        element?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    }

    async screenshot(options?: any): Promise<string> {
        throw new Error('Screenshot functionality within iframes remains unimplemented')
    }

    async dblClick(): Promise<void> {
        const element = await this.retrieveElement()
        element?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    }

    async dragTo(target: Locator): Promise<void> {
        throw new Error('Drag-and-drop functionality within iframes remains unimplemented')
    }

    async selectOptions(values: string | string[]): Promise<void> {
        const element = await this.retrieveElement()
        if (element instanceof HTMLSelectElement) {
            const selectionValues = Array.isArray(values) ? values : [values]
            Array.from(element.options).forEach(opt => opt.selected = selectionValues.includes(opt.value))
            element.dispatchEvent(new Event('change', { bubbles: true }))
        }
    }

    async unhover(): Promise<void> {
        const element = await this.retrieveElement()
        element?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    }

    async element(): Promise<Element> {
        return this.retrieveElement()
    }

    async elements(): Promise<Element[]> {
        const iframe = await this.retrieveIframe()
        return iframe.contentDocument ?
            Array.from(iframe.contentDocument.querySelectorAll(this.elementSelector)) :
            []
    }

    getByRole(role: ARIARole | string, options?: LocatorByRoleOptions): Locator {
        return this.createNestedLocator(`[role="${role}"]`)
    }

    getByText(text: string | RegExp, options?: LocatorOptions): Locator {
        return this.createNestedLocator(`*[contains(text(), '${text instanceof RegExp ? text.source : text}')]`)
    }

    filter(options: { hasText?: string | RegExp; has?: Locator }): Locator {
        let modifiedSelector = this.elementSelector
        if (options.hasText) {
            const textContent = options.hasText instanceof RegExp ?
                options.hasText.source :
                options.hasText
            modifiedSelector += `[contains(text(), '${textContent}')]`
        }
        return new FrameLocatorImplementation(
            this.iframeManager,
            this.frameSelector,
            modifiedSelector,
            this.options
        )
    }

    first(): Locator {
        return this.createNestedLocator(`(${this.elementSelector})[1]`)
    }

    last(): Locator {
        return this.createNestedLocator(`(${this.elementSelector})[last()]`)
    }

    nth(index: number): Locator {
        return this.createNestedLocator(`(${this.elementSelector})[${index + 1}]`)
    }

    private createNestedLocator(extension: string): Locator {
        return new FrameLocatorImplementation(
            this.iframeManager,
            this.frameSelector,
            `${this.elementSelector} ${extension}`,
            this.options
        )
    }

    private async retrieveIframe(): Promise<HTMLIFrameElement> {
        const frameElement = document.querySelector(this.frameSelector) as HTMLIFrameElement
        if (!frameElement) {
            throw new Error(`Target frame "${this.frameSelector}" not found in document`)
        }

        const frameIdentifier = this.iframeManager.registerIframe(frameElement)
        return this.iframeManager.waitForReady(frameIdentifier)
    }

    private async retrieveElement(): Promise<Element> {
        const iframe = await this.retrieveIframe()
        if (!iframe.contentDocument) {
            throw new Error('Iframe content document unavailable')
        }

        const targetElement = iframe.contentDocument.querySelector(this.elementSelector)
        if (!targetElement) {
            throw new Error(`Element "${this.elementSelector}" not found within iframe`)
        }

        return targetElement
    }
}