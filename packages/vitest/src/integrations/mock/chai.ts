import type { ChaiPlugin } from '@vitest/expect'
import { wrapAssertion } from '@vitest/expect'
import { isWhenChain } from './when'

export const MockPlugin: ChaiPlugin = (chai, utils) => {
  utils.addMethod(
    chai.Assertion.prototype,
    'toHaveBeenExhausted',
    wrapAssertion(utils, 'toHaveBeenExhausted', function (this) {
      const isNot = !!utils.flag(this, 'negate')
      const w = utils.flag(this, 'object')

      if (!isWhenChain(w)) {
        throw new TypeError(
          `${utils.inspect(w)} is not a \`vi.when\` instance`,
        )
      }

      const diagnostics = w._getDiagnostics()

      if (diagnostics.isExhausted === isNot) {
        throw new chai.AssertionError(isNot
          ? 'expected at least one behavior to remain un-exhausted, but all were'
          : `expected all behaviors to have been exhausted, but some remain:\n\n  ${diagnostics.pendingBehaviors.replaceAll(/\n(?!\n)/g, '\n  ')}`)
      }
    }),
  )
}
