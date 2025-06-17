import type { TestAttachment } from '@vitest/runner'
import mime from 'mime/lite'
import { isReport } from '~/constants'

export function getAttachmentUrl(attachment: TestAttachment): string {
  // html reporter always saves files into /data/ folder
  if (isReport) {
    return `/data/${attachment.path}`
  }
  const contentType = attachment.contentType ?? 'application/octet-stream'
  if (attachment.path) {
    return `/__vitest_attachment__?path=${encodeURIComponent(attachment.path)}&contentType=${contentType}&token=${(window as any).VITEST_API_TOKEN}`
  }
  // attachment.body is always a string outside of the test frame
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
