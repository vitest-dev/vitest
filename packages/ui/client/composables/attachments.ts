import type { TestAttachment } from 'vitest'
import mime from 'mime/lite'
import { basename } from 'pathe'
import { isReport } from '~/constants'

export function getAttachmentUrl(attachment: TestAttachment): string {
  const contentType = attachment.contentType ?? 'application/octet-stream'
  if (attachment.path) {
    if (isReport) {
      return `./attachments/${basename(attachment.path)}`
    }
    return `/__vitest_attachment__?path=${encodeURIComponent(attachment.path)}&contentType=${contentType}&token=${(window as any).VITEST_API_TOKEN}`
  }
  // attachment.body is always a string outside of the test frame
  if (attachment.bodyEncoding === 'utf-8') {
    return `data:${contentType},${encodeURIComponent(attachment.body as string)}`
  }
  return `data:${contentType};base64,${attachment.body}`
}

export function sanitizeFilePath(s: string, contentType: string | undefined): string {
  const extension = contentType ? mime.getExtension(contentType) : null
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x2C\x2E\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-') + (extension ? `.${extension}` : '')
}

export function isExternalAttachment(attachment: TestAttachment): boolean {
  const potentialUrl = attachment.path || attachment.body
  return typeof potentialUrl === 'string' && (potentialUrl.startsWith('http://') || potentialUrl.startsWith('https://'))
}

export function internalOrExternalUrl(attachment: TestAttachment): string {
  const potentialUrl = attachment.path || attachment.body

  if (typeof potentialUrl === 'string' && (potentialUrl.startsWith('http://') || potentialUrl.startsWith('https://'))) {
    return potentialUrl
  }

  return getAttachmentUrl(attachment)
}

export async function openPlaywrightTrace(attachment: TestAttachment): Promise<void> {
  const popup = window.open('', '_blank')
  if (!popup) {
    return
  }

  popup.document.write('<!doctype html><title>Opening Playwright Trace</title><body>Opening Playwright trace...</body>')
  popup.document.close()
  popup.focus()

  try {
    const response = await fetch(getAttachmentUrl(attachment))
    if (!response.ok) {
      throw new Error(`Failed to load Playwright trace: ${response.statusText}`)
    }
    const trace = await response.blob()
    if (popup.closed) {
      return
    }
    popup.location.href = 'https://trace.playwright.dev/'
    // TODO: Ask Playwright to expose a readiness signal instead of relying on a fixed delay.
    setTimeout(() => {
      if (!popup.closed) {
        popup.postMessage({ method: 'load', params: { trace } }, 'https://trace.playwright.dev')
      }
    }, 1000)
  }
  catch {
    if (!popup.closed) {
      popup.document.write('<!doctype html><title>Failed to Open Playwright Trace</title><body>Failed to load Playwright trace attachment.</body>')
      popup.document.close()
    }
  }
}
