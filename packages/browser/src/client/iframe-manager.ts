interface FrameMetadata {
  element: HTMLIFrameElement
  identifier: string
  isReady: boolean
  contentWindow: Window | null
  contentDocument: Document | null
}

export class IframeManager {
  private frameRegistry = new Map<string, FrameMetadata>()
  private mutationObservers = new Map<string, MutationObserver>()
  private readinessResolvers = new Map<string, Promise<void>>()

  constructor() {
    this.initializeDomObserver()
  }

  registerFrame(element: HTMLIFrameElement): string {
    const frameId = this.createFrameIdentifier(element)
    const metadata: FrameMetadata = {
      element,
      identifier: frameId,
      isReady: false,
      contentWindow: null,
      contentDocument: null
    }

    this.frameRegistry.set(frameId, metadata)
    this.monitorFrameReadiness(frameId, element)

    return frameId
  }

  async awaitFramePreparation(id: string): Promise<FrameMetadata> {
    const preparationPromise = this.readinessResolvers.get(id)
    if (!preparationPromise) {
      throw new Error(`Frame "${id}" not registered in tracking system`)
    }

    await preparationPromise
    return this.frameRegistry.get(id)!
  }

  retrieveFrameData(id: string): FrameMetadata | undefined {
    return this.frameRegistry.get(id)
  }

  deregisterFrame(id: string): void {
    this.mutationObservers.get(id)?.disconnect()
    this.mutationObservers.delete(id)
    this.frameRegistry.delete(id)
    this.readinessResolvers.delete(id)
  }

  async executeInFrameContext<T>(id: string, operation: () => T): Promise<T> {
    const frame = await this.awaitFramePreparation(id)

    if (!frame.contentWindow) {
      throw new Error(`Content window unavailable for frame "${id}"`)
    }

    return frame.contentWindow.eval(`(${operation.toString()})()`)
  }

  private initializeDomObserver(): void {
    const domObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement
            if (element.tagName === 'IFRAME') {
              this.registerFrame(element as HTMLIFrameElement)
            }

            element.querySelectorAll('iframe').forEach(iframe => {
              this.registerFrame(iframe)
            })
          }
        })
      })
    })

    domObserver.observe(document.body, {
      childList: true,
      subtree: true
    })
  }

  private monitorFrameReadiness(id: string, element: HTMLIFrameElement): void {
    const readinessPromise = new Promise<void>(resolve => {
      const verifyReadiness = () => {
        if (this.checkFrameStatus(element)) {
          const metadata = this.frameRegistry.get(id)!
          metadata.isReady = true
          metadata.contentWindow = element.contentWindow
          metadata.contentDocument = element.contentDocument
          resolve()
        } else {
          setTimeout(verifyReadiness, 10)
        }
      }

      if (this.checkFrameStatus(element)) {
        verifyReadiness()
      } else {
        element.addEventListener('load', verifyReadiness, { once: true })
        setTimeout(verifyReadiness, 0)
      }
    })

    this.readinessResolvers.set(id, readinessPromise)
  }

  private checkFrameStatus(element: HTMLIFrameElement): boolean {
    try {
      return !!(
        element.contentWindow &&
        element.contentDocument &&
        element.contentDocument.readyState === 'complete'
      )
    } catch {
      return false
    }
  }

  private createFrameIdentifier(element: HTMLIFrameElement): string {
    if (element.id) return element.id
    if (element.dataset.testid) return element.dataset.testid

    const frameElements = Array.from(document.querySelectorAll('iframe'))
    const positionIndex = frameElements.indexOf(element)
    return `frame-${positionIndex}-${Date.now()}`
  }
}