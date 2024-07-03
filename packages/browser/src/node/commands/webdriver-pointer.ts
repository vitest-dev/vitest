import type { PointerInput } from './pointer-helper'
import { collectActions } from './pointer-helper'

export async function webdriverPointerImplementation(
  browser: WebdriverIO.Browser,
  input: PointerInput,
) {
  const targets = new Map<string, WebdriverIO.Element>()
  for await (const action of collectWDIOActions(browser, targets, input)) {
    await action.perform()
  }
}

// hack to infer types
function createWDIOPointerAction(touch: boolean, browser: WebdriverIO.Browser) {
  return browser.action('pointer', { parameters: { pointerType: touch ? 'touch' : 'mouse' } })
}

async function* collectWDIOActions(
  browser: WebdriverIO.Browser,
  targets: Map<string, WebdriverIO.Element>,
  input: PointerInput,
) {
  let lastAction: {
    touch: boolean
    action: ReturnType<typeof createWDIOPointerAction>
  } = undefined!
  for (const action of collectActions(input)) {
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
        // todo: check also for coordinates?
        lastAction.action = lastAction.action.move({ origin: targets.get(action.target!)! })
      }
    }
  }

  yield lastAction.action
}
