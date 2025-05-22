import type { Locator, LocatorOptions, LocatorByRoleOptions, ARIARole } from './locator'

export interface FrameLocatorOptions {
    timeout?: number
    waitForReady?: boolean
    retry?: {
        count?: number
        delay?: number
    }
}

export interface FrameOptions {
    name?: string
    url?: string | RegExp
    selector?: string
    timeout?: number
}

export interface FrameLocator {
    getByRole(role: ARIARole | string, options?: LocatorByRoleOptions): Locator
    getByText(text: string | RegExp, options?: LocatorOptions): Locator
    getByTestId(testId: string | RegExp): Locator
    getByPlaceholder(text: string | RegExp, options?: LocatorOptions): Locator
    getByAltText(text: string | RegExp, options?: LocatorOptions): Locator
    getByTitle(text: string | RegExp, options?: LocatorOptions): Locator
    getByLabelText(text: string | RegExp, options?: LocatorOptions): Locator
    locator(selector: string): Locator
    first(): Locator
    last(): Locator
    nth(index: number): Locator
}

export interface Frame {
    name(): string | null
    url(): string
    isDetached(): boolean
    getByRole(role: ARIARole | string, options?: LocatorByRoleOptions): Locator
    getByText(text: string | RegExp, options?: LocatorOptions): Locator
    getByTestId(testId: string | RegExp): Locator
    getByPlaceholder(text: string | RegExp, options?: LocatorOptions): Locator
    getByAltText(text: string | RegExp, options?: LocatorOptions): Locator
    getByTitle(text: string | RegExp, options?: LocatorOptions): Locator
    getByLabelText(text: string | RegExp, options?: LocatorOptions): Locator
    locator(selector: string): Locator
    evaluate<T>(fn: () => T): Promise<T>
    evaluate<T, A>(fn: (arg: A) => T, arg: A): Promise<T>
    evaluate<T, A extends readonly unknown[]>(fn: (...args: A) => T, ...args: A): Promise<T>
    waitForLoadState(state?: 'load' | 'domcontentloaded' | 'networkidle'): Promise<void>
    waitForSelector(selector: string, options?: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' }): Promise<void>
    screenshot(options?: FrameScreenshotOptions): Promise<string>
    title(): Promise<string>
    currentUrl(): Promise<string>
    content(): Promise<string>
}

export interface FrameScreenshotOptions {
    path?: string
    base64?: boolean
    quality?: number
    type?: 'png' | 'jpeg'
    fullPage?: boolean
    clip?: {
        x: number
        y: number
        width: number
        height: number
    }
}

export interface BrowserPageWithFrames {
    frameLocator(selector: string, options?: FrameLocatorOptions): FrameLocator
    frame(options: FrameOptions): Promise<Frame>
    frames(): Promise<Frame[]>
    waitForFrame(selector: string, options?: { timeout?: number }): Promise<void>
}

export interface IframeInfo {
    element: HTMLIFrameElement
    id: string
    ready: boolean
    contentWindow: Window | null
    contentDocument: Document | null
    registeredAt: number
    currentUrl: string
    hasCorsRestrictions: boolean
}

export interface IframeManagerConfig {
    defaultTimeout?: number
    autoMonitor?: boolean
    readyCheckInterval?: number
    attemptCorsWorkaround?: boolean
    maxRetries?: number
    retryDelay?: number
}

export interface IframeManagerEvents {
    'iframe:detected': (info: IframeInfo) => void
    'iframe:ready': (info: IframeInfo) => void
    'iframe:removed': (info: IframeInfo) => void
    'iframe:error': (error: Error, info: IframeInfo) => void
    'iframe:urlchange': (oldUrl: string, newUrl: string, info: IframeInfo) => void
}

export interface FrameProviderCapabilities {
    supportsNativeFrameLocators: boolean
    supportsFrameScreenshots: boolean
    supportsFrameEvaluation: boolean
    supportsFrameLoadStates: boolean
    limitations?: string[]
}

export interface FrameCommands {
    playwright?: {
        getFrameLocator(selector: string): Promise<any>
        getFrame(options: FrameOptions): Promise<any>
        executeInFrame(frameSelector: string, action: string, ...args: any[]): Promise<any>
        screenshotFrame(frameSelector: string, options?: any): Promise<string>
    }
    webdriverio?: {
        switchToFrame(selector: string): Promise<void>
        switchToParentFrame(): Promise<void>
        executeInFrame(frameSelector: string, action: () => Promise<any>): Promise<any>
        getElementInFrame(frameSelector: string, elementSelector: string): Promise<any>
        isFrameAvailable(selector: string): Promise<boolean>
    }
}

export class FrameError extends Error {
    constructor(
        message: string,
        public readonly frameSelector: string,
        public readonly operation: string,
        public readonly cause?: Error
    ) {
        super(message)
        this.name = 'FrameError'
    }
}

export class FrameNotFoundError extends FrameError {
    constructor(frameSelector: string, cause?: Error) {
        super(`Frame not found: ${frameSelector}`, frameSelector, 'locate', cause)
        this.name = 'FrameNotFoundError'
    }
}

export class FrameNotReadyError extends FrameError {
    constructor(frameSelector: string, cause?: Error) {
        super(`Frame not ready: ${frameSelector}`, frameSelector, 'ready-check', cause)
        this.name = 'FrameNotReadyError'
    }
}

export class FrameCorsError extends FrameError {
    constructor(frameSelector: string, cause?: Error) {
        super(`CORS restrictions prevent access to frame: ${frameSelector}`, frameSelector, 'cors-access', cause)
        this.name = 'FrameCorsError'
    }
}

export type FrameLocatorMethod = keyof Omit<FrameLocator, 'first' | 'last' | 'nth'>
export type FrameMethod = keyof Frame
export type LocatorMethodsInFrame = 'click' | 'fill' | 'hover' | 'screenshot' | 'element' | 'elements'

export type FrameAction<T = void> = (frame: Frame) => Promise<T>
export type FrameLocatorAction<T = void> = (locator: FrameLocator) => Promise<T>

export interface FrameTestOptions {
    frameTimeout?: number
    waitForAllFrames?: boolean
    requiredFrames?: string[]
    cleanupFrames?: boolean
}