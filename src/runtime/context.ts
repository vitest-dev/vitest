import { GlobalContext } from '../types'

export const context: GlobalContext = {
  tasks: [],
  currentSuite: null,
}

if (!process.__vitest__) {
  console.warn('[vitest] Runtime is running in non-Vite environment, there might be some issues with your setup...')
  console.warn('cwd: ', process.cwd())
  console.warn('path:', __filename)
}
