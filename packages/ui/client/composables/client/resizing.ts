export type ResizeListener = (active: boolean) => void

const resizingSymbol = Symbol.for('resizing')

export function registerResizeListener(listener: ResizeListener) {
  inject<(listener: ResizeListener) => void>(resizingSymbol)?.(listener)
}

export function provideResizing() {
  const listeners = new Set<ResizeListener>()

  function addResizeListener(listener: ResizeListener) {
    listeners.add(listener)
  }

  function notify(active: boolean) {
    for (const listener of listeners)
      listener(active)
  }

  provide(resizingSymbol, addResizeListener)

  return { notify }
}
