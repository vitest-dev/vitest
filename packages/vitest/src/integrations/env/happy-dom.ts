import { importModule } from 'local-pkg'
import type { Environment } from '../../types'

export default <Environment>({
  name: 'happy-dom',
  async setup(global) {
    const { Window } = await importModule('happy-dom') as typeof import('happy-dom')
    const win: any = new Window()

    const glob = global.global

    global.global = win

    return {
      teardown(global) {
        win.happyDOM.cancelAsync()
        global.global = glob
      },
    }
  },
})
