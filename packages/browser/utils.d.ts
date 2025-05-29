// should be in sync with tester/public-utils.ts
// we cannot bundle it because vitest depend on the @vitest/browser and vise versa
// fortunately, the file is quite small

import { LocatorSelectors, Locator } from '@vitest/browser/context'
import { StringifyOptions } from 'vitest/internal/browser'

export type PrettyDOMOptions = Omit<StringifyOptions, 'maxLength'>

export declare function getElementLocatorSelectors(element: Element): LocatorSelectors
export declare function debug(
  el?: Element | Locator | null | (Element | Locator)[],
  maxLength?: number,
  options?: PrettyDOMOptions,
): void
export declare function prettyDOM(
  dom?: Element | Locator | undefined | null,
  maxLength?: number,
  prettyFormatOptions?: PrettyDOMOptions,
): string
export declare function getElementError(selector: string, container?: Element): Error
