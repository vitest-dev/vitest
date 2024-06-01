export type ResizingListener = (isResizing: boolean) => void

const resizingSymbol = Symbol.for('resizing')

export function registerResizingListener(listener: ResizingListener) {
  inject<(listener: ResizingListener) => void>(resizingSymbol)?.(listener)
}

export function provideResizing() {
  const listeners = new Set<ResizingListener>()

  function addResizeListener(listener: ResizingListener) {
    listeners.add(listener)
  }

  function notifyResizing(isResizing: boolean) {
    for (const listener of listeners)
      listener(isResizing)
  }

  provide(resizingSymbol, addResizeListener)

  return { notifyResizing }
}
