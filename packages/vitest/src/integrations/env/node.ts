import { Console } from 'console'
import type { Environment } from '../../types'

export default <Environment>({
  name: 'node',
  async setup(global) {
    global.console.Console = Console
    return {
      teardown(global) {
        delete global.console.Console
      },
    }
  },
})
