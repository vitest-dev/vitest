import type { SerializedLocator } from '@vitest/browser'
import type { Locator } from 'vitest/browser'
import type { BrowserCommand, BrowserCommandContext } from 'vitest/node'

export type UserEventCommand<T extends (...args: any) => any> = BrowserCommand<
  ConvertUserEventParameters<Parameters<T>>,
  ReturnType<T>
>

type ConvertElementToLocator<T> = T extends Element | Locator ? SerializedLocator : T
type ConvertUserEventParameters<T extends unknown[]> = {
  [K in keyof T]: ConvertElementToLocator<T[K]>;
}

// strip iframe locator part from the trace description e.g.
// - locator('[data-vitest="true"]').contentFrame().getByRole('button')
//     ⇓
// - getByRole('button')
export function getDescribedLocator(
  context: BrowserCommandContext,
  { locator, selector }: SerializedLocator,
): ReturnType<BrowserCommandContext['iframe']['locator']> {
  const iframeLocator = context.iframe.locator(selector)
  return typeof iframeLocator.describe === 'function'
    ? iframeLocator.describe(locator)
    : iframeLocator
}

interface Coordinates { x?: number; y?: number }

export async function resolvePageCoordinates(
  context: BrowserCommandContext,
  coords: Coordinates,
  onlyScale: boolean,
): Promise<Required<Coordinates>> {
  const x = coords?.x ?? 0
  const y = coords?.y ?? 0

  if (!context.project.config.browser.ui) {
    return { x, y }
  }

  const { iframeX, iframeY, scale } = await context.iframe.owner().evaluate((iframe) => {
    const { x, y } = iframe.getBoundingClientRect()
    const scale = new DOMMatrix(getComputedStyle(iframe).transform).a

    return { iframeX: x, iframeY: y, scale }
  })

  const offsetX = onlyScale ? 0 : iframeX
  const offsetY = onlyScale ? 0 : iframeY

  return {
    x: offsetX + x * scale,
    y: offsetY + y * scale,
  }
}
