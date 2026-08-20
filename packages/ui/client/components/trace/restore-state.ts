import type { Mirror } from 'rrweb-snapshot'

export function restoreOpenPopovers(mirror: Mirror, popoverIds: number[]): void {
  for (const id of popoverIds) {
    const element = mirror.getNode(id) as HTMLElement | null
    element?.showPopover?.()
  }
}
