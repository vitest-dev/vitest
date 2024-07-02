import { parseKeyDef } from '@testing-library/user-event/dist/esm/pointer/parseKeyDef.js'
import { defaultKeyMap } from '@testing-library/user-event/dist/esm/pointer/keyMap.js'
// @ts-expect-error no types
import type { PointerCoords } from '@testing-library/user-event/dist/types/event'
// @ts-expect-error no types
import type { pointerKey } from '@testing-library/user-event/dist/types/system/pointer'
import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

// todo: try to add proper types to avoid duplicating
type PointerActionInput = string | ({
  keys: string
} & PointerActionPosition) | PointerAction
type PointerInput = PointerActionInput[]
type PointerAction = PointerPressAction | PointerMoveAction
interface PointerActionPosition {
  target?: string
  coords?: PointerCoords
  node?: string
  /**
   * If `node` is set, this is the DOM offset.
   * Otherwise this is the `textContent`/`value` offset on the `target`.
   */
  offset?: number
}
interface PointerPressAction extends PointerActionPosition {
  keyDef: pointerKey
  releasePrevious: boolean
  releaseSelf: boolean
}
interface PointerMoveAction extends PointerActionPosition {
  pointerName?: string
}

export const pointer: UserEventCommand<UserEvent['pointer']> = async (
  context,
  input: PointerInput,
) => {
  const provider = context.provider
  // todo: cleanup
  if (!input.length || provider instanceof PlaywrightBrowserProvider) {
    return
  }

  // const provider = context.provider
  if (provider instanceof PlaywrightBrowserProvider) {
    throw new TypeError(`Provider "${provider.name}" does not support pointer events`)
  }
  else if (provider instanceof WebdriverBrowserProvider) {
    await webdriverioPointerImplementation(context.browser, input)
  }
  else {
    throw new TypeError(`Provider "${provider.name}" does not support pointer events`)
  }
}
/*
async function _playwrightPointerImplementation(
  provider: PlaywrightBrowserProvider,
  input: PointerInput,
) {
  const actions = provider.browser
} */
async function webdriverioPointerImplementation(
  browser: WebdriverIO.Browser,
  input: PointerInput,
) {
  const actions = collectActions(input)
  const targets = new Map<string, WebdriverIO.Element>()
  for await (const action of executeWDIOActions(browser, targets, actions)) {
    await action.perform()
  }
}

// https://github.com/testing-library/user-event/blob/main/src/pointer/index.ts
function collectActions(input: PointerInput) {
  const actions: PointerAction[] = []
  // collect actions
  for (let i = 0; i < input.length; i++) {
    const actionInput = input[i]
    if (typeof actionInput === 'string') {
      actions.push(...parseKeyDef(defaultKeyMap, actionInput))
    }
    else if ('keys' in actionInput) {
      actions.push(
        ...parseKeyDef(defaultKeyMap, actionInput.keys).map(i => ({
          ...actionInput,
          ...i,
        })),
      )
    }
    else {
      actions.push(actionInput)
    }
  }

  return actions
}

function createWDIOPointerAction(touch: boolean, browser: WebdriverIO.Browser) {
  return browser.action('pointer', { parameters: { pointerType: touch ? 'touch' : 'mouse' } })
}

async function* executeWDIOActions(
  browser: WebdriverIO.Browser,
  targets: Map<string, WebdriverIO.Element>,
  actions: PointerAction[],
) {
  let lastAction: {
    touch: boolean
    action: ReturnType<typeof createWDIOPointerAction>
  } = undefined!
  for (const action of actions) {
    if ('target' in action) {
      const target = action.target
      if (target && !targets.has(target)) {
        targets.set(target, await browser.$(`//${target}`))
      }
    }
    if ('node' in action) {
      const node = action.node
      if (node && !targets.has(node)) {
        targets.set(node, await browser.$(`//${node}`))
      }
    }
    if ('keyDef' in action) {
      if (lastAction) {
        if (lastAction.touch) {
          yield lastAction.action
          lastAction = {
            touch: false,
            action: createWDIOPointerAction(false, browser),
          }
        }
      }
      else {
        lastAction = {
          touch: false,
          action: createWDIOPointerAction(true, browser),
        }
      }
      if (action.releasePrevious) {
        lastAction.action = lastAction.action.up().pause(50)
      }
      lastAction.action = lastAction.action.down()
      if (action.releaseSelf) {
        lastAction.action = lastAction.action.up().pause(50)
      }
    }
    else {
      if (action.pointerName) {
        if (lastAction) {
          if (!lastAction.touch) {
            yield lastAction.action
            lastAction = {
              touch: true,
              action: createWDIOPointerAction(true, browser),
            }
          }
        }
        else {
          lastAction = {
            touch: true,
            action: createWDIOPointerAction(true, browser),
          }
        }
        const params: any = {}
        const { x, y } = action.coords ?? {}
        if (x !== undefined && y !== undefined) {
          params.x = x
          params.y = y
        }
        if (action.target) {
          const target = targets.get(action.target)
          if (target) {
            params.origin = target
          }
        }
        params.button = action.pointerName === 'left' ? 0 : action.pointerName === 'right' ? 2 : 1
        lastAction.action = lastAction.action.move(params)
      }
      else {
        if (lastAction) {
          if (lastAction.touch) {
            yield lastAction.action
            lastAction = {
              touch: false,
              action: createWDIOPointerAction(false, browser),
            }
          }
        }
        else {
          lastAction = {
            touch: false,
            action: createWDIOPointerAction(false, browser),
          }
        }
        // todo: check also for coordinates
        lastAction.action = lastAction.action.move({ origin: targets.get(action.target!)! })
      }
    }
  }

  yield lastAction.action
}
