import { createCache, createMirror, rebuild, snapshot } from 'rrweb-snapshot'
import { afterEach, expect, test } from 'vitest'
import { restoreOpenPopovers } from './restore-state'

const iframes: HTMLIFrameElement[] = []

afterEach(() => {
  for (const iframe of iframes.splice(0)) {
    iframe.remove()
  }
})

test('restores open popovers after rebuilding a snapshot', () => {
  const source = document.createElement('iframe')
  document.body.append(source)
  iframes.push(source)

  const sourceDocument = source.contentDocument!
  const popover = sourceDocument.createElement('div')
  popover.setAttribute('popover', 'auto')
  sourceDocument.body.append(popover)
  popover.showPopover()

  const sourceMirror = createMirror()
  const serialized = snapshot(sourceDocument, { mirror: sourceMirror })
  const popoverId = sourceMirror.getId(popover)

  const target = document.createElement('iframe')
  document.body.append(target)
  iframes.push(target)

  const targetMirror = createMirror()
  rebuild(serialized, {
    doc: target.contentDocument!,
    cache: createCache(),
    mirror: targetMirror,
    UNSAFE_allowUnprotectedRebuild: true,
  })

  const restoredPopover = targetMirror.getNode(popoverId) as HTMLElement
  expect(restoredPopover.matches(':popover-open')).toBe(false)

  restoreOpenPopovers(targetMirror, [popoverId])

  expect(restoredPopover.matches(':popover-open')).toBe(true)
})
