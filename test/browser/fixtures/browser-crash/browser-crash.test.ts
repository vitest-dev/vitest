import { commands } from 'vitest/browser'
import { it } from 'vitest'

declare module 'vitest/browser' {
  interface BrowserCommands {
    forceCrash: () => Promise<void>
  }
}

it('fails gracefully when browser crashes', async () => {
  await commands.forceCrash()
})
