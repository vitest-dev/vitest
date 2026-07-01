import { getBrowserState, getWorkerState, now } from '../utils'

// Faithful duplicate of the runtime budget clamp
// (packages/vitest/src/runtime/runner/context.ts). It is copied wholesale
// rather than imported so the browser bundle does not pull in node-only runner
// code; keep the two implementations in sync.

/**
 * Buffer (ms) subtracted from the remaining test/hook budget so that a clamped
 * operation fails *before* the test timer, producing a descriptive error.
 */
export const TIMEOUT_BUFFER = 300

/**
 * Fixed timeout (ms) used for `'auto'` operations when there is no test budget
 * to ride (outside a test, or the budget is disabled).
 */
export const AUTO_TIMEOUT_FALLBACK = 1000

export interface BudgetedTimeout {
  /** The effective timeout to use (ms). */
  timeout: number
  /** The configured/per-call cap before clamping, or `undefined` for `'auto'`. */
  requested: number | undefined
  /** `true` when the remaining test budget (not the requested cap) set the timeout. */
  clampedByBudget: boolean
}

/** A {@link BudgetedTimeout} plus a human-readable description for error messages. */
export interface DescribedTimeout extends BudgetedTimeout {
  description: string
}

/**
 * The remaining budget of the currently-executing test or hook, or `undefined`
 * when it can't be determined: outside a test/hook or when the budget is
 * disabled (`0`/`Infinity`).
 */
export function getCurrentBudget(): { startTime: number; timeout: number } | undefined {
  const runner = getBrowserState().runner
  const startTime = runner._currentTaskStartTime
  const timeout = runner._currentTaskTimeout
  if (startTime == null || timeout == null || timeout <= 0 || timeout === Number.POSITIVE_INFINITY) {
    return undefined
  }
  return { startTime, timeout }
}

/**
 * Resolve an effective timeout for a budget-clamped operation from a config
 * value (`number | 'auto'`) and an optional per-call override. Per-call wins as
 * the cap; `'auto'` rides the budget; with no budget and no cap, falls back to
 * {@link AUTO_TIMEOUT_FALLBACK}.
 */
export function resolveBudgetedTimeout(
  perCall: number | undefined,
  configValue: number | 'auto' | undefined,
): BudgetedTimeout {
  const cap = perCall ?? (configValue === 'auto' ? undefined : configValue)
  const budget = getCurrentBudget()
  if (!budget) {
    return { timeout: cap ?? AUTO_TIMEOUT_FALLBACK, requested: cap, clampedByBudget: false }
  }
  const remaining = Math.max(Math.floor(budget.startTime + budget.timeout - now()) - TIMEOUT_BUFFER, 1)
  if (cap == null) {
    return { timeout: remaining, requested: undefined, clampedByBudget: true }
  }
  return { timeout: Math.min(cap, remaining), requested: cap, clampedByBudget: remaining < cap }
}

/**
 * Human-readable timeout description for error messages, noting when the
 * effective timeout was capped by the remaining test budget. `setting` is the
 * config path that controls it, e.g. `test.timeout.action`.
 */
export function describeBudgetedTimeout(resolved: BudgetedTimeout, setting: string): string {
  if (resolved.clampedByBudget) {
    const configured = resolved.requested != null
      ? `configured ${setting}: ${resolved.requested}ms`
      : `${setting}: 'auto'`
    return `${resolved.timeout}ms (capped by the remaining test time; ${configured})`
  }
  return `${resolved.timeout}ms (${setting})`
}

/**
 * Resolve the effective timeout for a browser action / locator / `expect.element`
 * operation. A per-call `timeout` wins, then `timeout.action` (when a number),
 * then the provider-level `actionTimeout`; `'auto'` (and an unset config) ride
 * the remaining test budget.
 */
export function resolveActionTimeout(perCall: number | undefined): DescribedTimeout {
  const config = getWorkerState().config
  const actionConfig = config.timeout?.action
  const providerActionTimeout = config.browser.providerOptions.actionTimeout

  let configValue: number | 'auto' | undefined
  if (typeof actionConfig === 'number') {
    configValue = actionConfig
  }
  else if (actionConfig === 'auto') {
    configValue = 'auto'
  }
  else {
    configValue = providerActionTimeout ?? 'auto'
  }

  const resolved = resolveBudgetedTimeout(perCall, configValue)
  return {
    ...resolved,
    description: describeBudgetedTimeout(resolved, 'test.timeout.action'),
  }
}
