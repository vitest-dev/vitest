import { DefaultReporter } from './default'

export class BasicReporter extends DefaultReporter {
  isTTY = false as const
}
