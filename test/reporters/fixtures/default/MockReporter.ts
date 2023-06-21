import { DefaultReporter } from '../../../../packages/vitest/src/node/reporters/default'

export default class MockDefaultReporter extends DefaultReporter {
  isTTY = true
}
