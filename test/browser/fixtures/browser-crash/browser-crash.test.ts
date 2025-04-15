import { commands } from '@vitest/browser/context'
import { it } from 'vitest'

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    forceCrash: () => Promise<void>
  }
}

it('fails gracefully when browser crashes', async () => {
  await commands.forceCrash()
})
