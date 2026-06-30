import type { ChaiPlugin } from '@vitest/expect'
import { wrapAssertion } from '@vitest/expect'
import { isWhenChain } from './when'

export const MockPlugin: ChaiPlugin = (chai, utils) => {
  utils.addMethod(
    chai.Assertion.prototype,
    'toHaveBeenExhausted',
    wrapAssertion(utils, 'toHaveBeenExhausted', function (this) {
      const chain = utils.flag(this, 'object')

      if (!isWhenChain(chain)) {
        throw new TypeError(
          `${utils.inspect(chain)} is not a \`vi.when\` instance`,
        )
      }

      const diagnostics = chain._getDiagnostics()

      this.assert(
        diagnostics.isExhausted,
        `expected all behaviors to have been exhausted, but some remain:\n\n  ${diagnostics.pendingBehaviors.replaceAll(/\n(?!\n)/g, '\n  ')}`,
        'expected at least one behavior to remain un-exhausted, but all were',
      )
    }),
  )
}
