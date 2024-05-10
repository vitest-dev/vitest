import type { ResolvedConfig } from 'vitest'

type Platform =
  | 'aix'
  | 'android'
  | 'darwin'
  | 'freebsd'
  | 'haiku'
  | 'linux'
  | 'openbsd'
  | 'sunos'
  | 'win32'
  | 'cygwin'
  | 'netbsd'

export const server: {
  platform: Platform
}
export const page: {
  config: ResolvedConfig
}
