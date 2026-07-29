import { afterEach, beforeEach } from 'vitest'

function removeStyles() {
  document.head.querySelectorAll('style').forEach(style => style.remove())
}
export function useRemoveStyles() {
  beforeEach(() => removeStyles())
  afterEach(() => removeStyles())

  return {
    removeStyles,
  }
}
