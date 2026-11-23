export function getBrowserPlatform(): NodeJS.Platform | undefined {
  if (typeof navigator === 'undefined') {
    return undefined
  }
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const raw = (nav.userAgentData?.platform || nav.platform || nav.userAgent || '').toLowerCase()
  if (!raw) {
    return undefined
  }
  if (raw.includes('win')) {
    return 'win32'
  }
  if (raw.includes('mac') || raw.includes('iphone') || raw.includes('ipad') || raw.includes('ipod')) {
    return 'darwin'
  }
  if (raw.includes('android')) {
    return 'android'
  }
  if (raw.includes('linux') || raw.includes('x11') || raw.includes('cros')) {
    return 'linux'
  }
  if (raw.includes('freebsd')) {
    return 'freebsd'
  }
  if (raw.includes('openbsd')) {
    return 'openbsd'
  }
  if (raw.includes('sunos')) {
    return 'sunos'
  }
  return undefined
}
