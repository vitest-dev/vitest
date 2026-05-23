import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCache, createMirror, rebuild, snapshot } from 'rrweb-snapshot'

// Verifies that rebuilding an rrweb snapshot into a sandboxed iframe does not
// change the iframe document's URL. The bug: document.open() — called either
// from TraceView.vue directly or from inside rrweb-snapshot's buildNodeWithSN —
// makes Chrome update the iframe document URL to the parent page's URL, which
// produces confusing "Blocked script execution in '/__vitest__/'" sandbox warnings.

describe('TraceView iframe sandbox', () => {
  let targetIframe: HTMLIFrameElement
  let sourceIframe: HTMLIFrameElement

  beforeEach(() => {
    // Use a standards-mode document so rrweb does not serialize
    // compatMode: 'BackCompat', which intentionally still uses doc.open().
    sourceIframe = document.createElement('iframe')
    document.body.appendChild(sourceIframe)
    const srcDoc = sourceIframe.contentDocument!
    srcDoc.open()
    srcDoc.write('<!DOCTYPE html><html><head></head><body></body></html>')
    srcDoc.close()

    // Target: a sandboxed iframe that mirrors TraceView's setup (allow-same-origin, no allow-scripts).
    targetIframe = document.createElement('iframe')
    targetIframe.setAttribute('sandbox', 'allow-same-origin')
    document.body.appendChild(targetIframe)
  })

  afterEach(() => {
    sourceIframe.remove()
    targetIframe.remove()
  })

  it('does not change contentDocument.URL after rebuild', () => {
    const serialized = snapshot(sourceIframe.contentDocument!)
    expect(serialized, 'snapshot() must succeed on a blank document').not.toBeNull()

    const doc = targetIframe.contentDocument!
    expect(doc.URL).toBe('about:blank')

    rebuild(serialized!, {
      doc,
      cache: createCache(),
      mirror: createMirror(),
    })

    // If doc.open() was called (either locally or inside rrweb-snapshot),
    // Chrome changes the iframe document URL to the parent page URL.
    // The correct value after rebuild is still 'about:blank'.
    expect(targetIframe.contentDocument!.URL).toBe('about:blank')
  })
})
