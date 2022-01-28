// do not move this code to contributors.ts module
const __pwa_disabled__ = process.env.__PWA_DISABLED__ as any
// it seems define plugin expose the variable as boolean not as string
const lazyLoad = __pwa_disabled__ === true || __pwa_disabled__ === 'true' ? 'lazy' : null

export { lazyLoad }
