import type {
  UserEventClearOptions,
  UserEventClickOptions,
  UserEventDragAndDropOptions,
  UserEventFillOptions,
  UserEventHoverOptions,
  UserEventSelectOptions,
  UserEventUploadOptions,
} from 'vitest/browser'
import {
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByRoleSelector,
  getByTestIdSelector,
  getByTextSelector,
  getByTitleSelector,
  getIframeScale,
  Locator,
  resolveActionTimeout,
  selectorEngine,
} from '@vitest/browser/locators'
import { page, server } from 'vitest/browser'
import { __INTERNAL } from 'vitest/internal/browser'

// Resolve the action budget (from `timeout.action`): set the effective timeout on
// the options and return its description so the base action can pass it down to
// the command dispatch, which unifies a provider-native timeout error with it.
function withActionTimeout<T extends { timeout?: number }>(
  options: T | undefined,
): { options: T; timeoutDescription: string } {
  const resolved = resolveActionTimeout(options?.timeout)
  const resolvedOptions = (options ?? {}) as T
  resolvedOptions.timeout = resolved.timeout
  return { options: resolvedOptions, timeoutDescription: resolved.description }
}

class PlaywrightLocator extends Locator {
  constructor(public selector: string, protected _container?: Element) {
    super()
  }

  public override click(options?: UserEventClickOptions) {
    const { options: o, timeoutDescription } = withActionTimeout(processClickOptions(options))
    return super.click(o, timeoutDescription)
  }

  public override dblClick(options?: UserEventClickOptions): Promise<void> {
    const { options: o, timeoutDescription } = withActionTimeout(processClickOptions(options))
    return super.dblClick(o, timeoutDescription)
  }

  public override tripleClick(options?: UserEventClickOptions): Promise<void> {
    const { options: o, timeoutDescription } = withActionTimeout(processClickOptions(options))
    return super.tripleClick(o, timeoutDescription)
  }

  public override selectOptions(
    value: HTMLElement | HTMLElement[] | Locator | Locator[] | string | string[],
    options?: UserEventSelectOptions,
  ): Promise<void> {
    const { options: o, timeoutDescription } = withActionTimeout(options)
    return super.selectOptions(value, o, timeoutDescription)
  }

  public override clear(options?: UserEventClearOptions): Promise<void> {
    const { options: o, timeoutDescription } = withActionTimeout(options)
    return super.clear(o, timeoutDescription)
  }

  public override hover(options?: UserEventHoverOptions): Promise<void> {
    const { options: o, timeoutDescription } = withActionTimeout(processHoverOptions(options))
    return super.hover(o, timeoutDescription)
  }

  public override upload(
    files: string | string[] | File | File[],
    options?: UserEventUploadOptions,
  ): Promise<void> {
    const { options: o, timeoutDescription } = withActionTimeout(options)
    return super.upload(files, o, timeoutDescription)
  }

  public override fill(text: string, options?: UserEventFillOptions): Promise<void> {
    const { options: o, timeoutDescription } = withActionTimeout(options)
    return super.fill(text, o, timeoutDescription)
  }

  public override dropTo(target: Locator, options?: UserEventDragAndDropOptions): Promise<void> {
    const { options: o, timeoutDescription } = withActionTimeout(processDragAndDropOptions(options))
    return super.dropTo(target, o, timeoutDescription)
  }

  protected locator(selector: string) {
    return new PlaywrightLocator(`${this.selector} >> ${selector}`, this._container)
  }

  protected elementLocator(element: Element) {
    return new PlaywrightLocator(
      selectorEngine.generateSelectorSimple(element),
      element,
    )
  }
}

page.extend({
  getByLabelText(text, options) {
    return new PlaywrightLocator(getByLabelSelector(text, options))
  },
  getByRole(role, options) {
    return new PlaywrightLocator(getByRoleSelector(role, options))
  },
  getByTestId(testId) {
    return new PlaywrightLocator(getByTestIdSelector(server.config.browser.locators.testIdAttribute, testId))
  },
  getByAltText(text, options) {
    return new PlaywrightLocator(getByAltTextSelector(text, options))
  },
  getByPlaceholder(text, options) {
    return new PlaywrightLocator(getByPlaceholderSelector(text, options))
  },
  getByText(text, options) {
    return new PlaywrightLocator(getByTextSelector(text, options))
  },
  getByTitle(title, options) {
    return new PlaywrightLocator(getByTitleSelector(title, options))
  },

  elementLocator(element: Element) {
    return new PlaywrightLocator(
      selectorEngine.generateSelectorSimple(element),
      element,
    )
  },
  frameLocator(locator: Locator) {
    return new PlaywrightLocator(
      `${locator.selector} >> internal:control=enter-frame`,
    )
  },
})

__INTERNAL._createLocator = selector => new PlaywrightLocator(selector)

function processDragAndDropOptions(options?: UserEventDragAndDropOptions) {
  if (!options) {
    return options
  }
  if (options.sourcePosition) {
    options.sourcePosition = processPlaywrightPosition(options.sourcePosition)
  }
  if (options.targetPosition) {
    options.targetPosition = processPlaywrightPosition(options.targetPosition)
  }
  return options
}

function processHoverOptions(options?: UserEventHoverOptions) {
  if (!options) {
    return options
  }
  if (options.position) {
    options.position = processPlaywrightPosition(options.position)
  }
  return options
}

function processClickOptions(options?: UserEventClickOptions) {
  if (!options) {
    return options
  }
  if (options.position) {
    options.position = processPlaywrightPosition(options.position)
  }
  return options
}

function processPlaywrightPosition(position: { x: number; y: number }) {
  const scale = getIframeScale()
  if (position.x != null) {
    position.x *= scale
  }
  if (position.y != null) {
    position.y *= scale
  }
  return position
}
