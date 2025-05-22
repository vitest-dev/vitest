import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { IframeManager } from '../src/client/iframe-manager'
import { FrameLocator } from '../src/client/frame-locator'
import { enhanceBrowserPage } from '../src/client/page-extensions'

const createMockPage = () => ({
    extend: vi.fn(),
    getByRole: vi.fn(),
    getByText: vi.fn(),
    getByTestId: vi.fn(),
    getByPlaceholder: vi.fn(),
    getByAltText: vi.fn(),
    getByTitle: vi.fn(),
    getByLabelText: vi.fn(),
    elementLocator: vi.fn(),
    _createLocator: vi.fn(),
    viewport: vi.fn(),
    screenshot: vi.fn(),
})

describe('Browser Iframe API', () => {
    let testContainer: HTMLDivElement

    beforeEach(() => {
        testContainer = document.createElement('div')
        testContainer.id = 'test-container'
        document.body.appendChild(testContainer)
    })

    afterEach(() => {
        if (testContainer?.parentNode) {
            testContainer.parentNode.removeChild(testContainer)
        }
        document.querySelectorAll('iframe').forEach(iframe => iframe.remove())
    })

    describe('IframeManager', () => {
        let iframeManager: IframeManager

        beforeEach(() => {
            iframeManager = new IframeManager()
        })

        test('should create instance successfully', () => {
            expect(iframeManager).toBeDefined()
            expect(iframeManager).toBeInstanceOf(IframeManager)
        })

        test('should register iframe with auto-generated ID', () => {
            const iframe = document.createElement('iframe')
            iframe.srcdoc = '<html><body><p>Test</p></body></html>'
            testContainer.appendChild(iframe)

            const frameId = iframeManager.registerFrame(iframe)

            expect(frameId).toBeDefined()
            expect(typeof frameId).toBe('string')
            expect(frameId.length).toBeGreaterThan(0)
        })

        test('should register iframe with custom test-id', () => {
            const iframe = document.createElement('iframe')
            iframe.setAttribute('data-testid', 'custom-frame')
            iframe.srcdoc = '<html><body><p>Test</p></body></html>'
            testContainer.appendChild(iframe)

            const frameId = iframeManager.registerFrame(iframe)

            expect(frameId).toBe('custom-frame')
        })

        test('should get iframe info correctly', () => {
            const iframe = document.createElement('iframe')
            iframe.id = 'test-frame'
            testContainer.appendChild(iframe)

            const frameId = iframeManager.registerFrame(iframe)
            const iframeInfo = iframeManager.retrieveFrameData(frameId)

            expect(iframeInfo).toBeDefined()
            expect(iframeInfo?.element).toBe(iframe)
            expect(iframeInfo?.identifier).toBe(frameId)
        })

        test('should unregister iframe correctly', () => {
            const iframe = document.createElement('iframe')
            testContainer.appendChild(iframe)

            const frameId = iframeManager.registerFrame(iframe)
            expect(iframeManager.retrieveFrameData(frameId)).toBeDefined()

            iframeManager.deregisterFrame(frameId)
            expect(iframeManager.retrieveFrameData(frameId)).toBeUndefined()
        })
    })

    describe('FrameLocator', () => {
        let frameLocator: FrameLocator
        let iframeManager: IframeManager

        beforeEach(() => {
            iframeManager = new IframeManager()
            frameLocator = new FrameLocator(iframeManager, '[data-testid="test-frame"]')
        })

        test('should create instance with correct selector', () => {
            expect(frameLocator).toBeDefined()
            expect(frameLocator).toBeInstanceOf(FrameLocator)
        })

        test('should create child locators correctly', () => {
            const textLocator = frameLocator.getByText('Test Text')
            const testIdLocator = frameLocator.getByTestId('button')
            const roleLocator = frameLocator.getByRole('button')

            expect(textLocator).toBeDefined()
            expect(testIdLocator).toBeDefined()
            expect(roleLocator).toBeDefined()
        })

        test('should handle selector composition', () => {
            const locator = frameLocator.locator('.custom-class')
            expect(locator).toBeDefined()
        })
    })

    describe('Enhanced Page API', () => {
        let mockPage: ReturnType<typeof createMockPage>
        let enhancedPage: ReturnType<typeof enhanceBrowserPage>

        beforeEach(() => {
            mockPage = createMockPage()
            enhancedPage = enhanceBrowserPage(mockPage as any)
        })

        test('should extend page with iframe methods', () => {
            expect(enhancedPage.frameLocator).toBeDefined()
            expect(typeof enhancedPage.frameLocator).toBe('function')

            expect(enhancedPage.frame).toBeDefined()
            expect(typeof enhancedPage.frame).toBe('function')

            expect(enhancedPage.frames).toBeDefined()
            expect(typeof enhancedPage.frames).toBe('function')
        })

        test('should create frame locator correctly', () => {
            const frameLocator = enhancedPage.frameLocator('[data-testid="my-frame"]')
            expect(frameLocator).toBeDefined()
            expect(frameLocator).toBeInstanceOf(FrameLocator)
        })

        test('should preserve original page methods', () => {
            expect(enhancedPage.extend).toBe(mockPage.extend)
            expect(enhancedPage.getByRole).toBe(mockPage.getByRole)
            expect(enhancedPage.getByText).toBe(mockPage.getByText)
        })
    })

    describe('Integration Tests', () => {
        test('should work together in realistic scenario', async () => {
            const iframe = document.createElement('iframe')
            iframe.setAttribute('data-testid', 'app-frame')
            iframe.srcdoc = `
                <html>
                    <body>
                        <button data-testid="submit-btn">Submit</button>
                        <input data-testid="name-input" placeholder="Enter name" />
                    </body>
                </html>
            `
            testContainer.appendChild(iframe)

            const mockPage = createMockPage()
            const enhancedPage = enhanceBrowserPage(mockPage as any)

            const frameLocator = enhancedPage.frameLocator('[data-testid="app-frame"]')

            const submitButton = frameLocator.getByTestId('submit-btn')
            const nameInput = frameLocator.getByPlaceholder('Enter name')

            expect(submitButton).toBeDefined()
            expect(nameInput).toBeDefined()
        })
    })
})