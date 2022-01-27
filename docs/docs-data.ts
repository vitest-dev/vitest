/* Texts */
export const vitestName = 'Vitest'
export const vitestShortName = 'Vitest'
export const vitestDescription = 'A blazing fast unit test framework powered by Vite'

/* CDN fonts and styles */
export const googleapis = 'https://fonts.googleapis.com'
export const gstatic = 'https://fonts.gstatic.com'
export const font = `${googleapis}/css2?family=Readex+Pro:wght@200;400;600&display=swap`

/* vitepress head */
export const ogUrl = 'https://vitest.dev/'
export const ogImage = `${ogUrl}og.png`

/* GitHub and social links */
export const releases = 'https://github.com/vitest-dev/vitest/releases'
export const contributing = 'https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md'
export const discord = 'https://chat.vitest.dev'
export const twitter = 'https://twitter.com/vitest_dev'

/* Avatar/Image servers */
export const imageServers: Record<string, string> = {
  // for antfu sponsors
  jsdelivr: 'cdn.jsdelivr.net',
  // for patak sponsors
  patak: 'patak.dev',
  // GitHub contributor avatars
  github: 'github.com',
  avatars: 'avatars.githubusercontent.com',
}
export const preconnectLinks = [googleapis, gstatic]
export const preconnectHomeLinks = [googleapis, gstatic, ...Object.values(imageServers).map(s => `https://${s}`)]

/* PWA runtime caching urlPattern regular expressions */
export const pwaImagesRegex = new RegExp(`^https://(${Object.values(imageServers).join('|')})/.*`, 'i')
export const pwaFontsRegex = new RegExp(`^${googleapis}/.*`, 'i')
export const pwaFontStylesRegex = new RegExp(`^${gstatic}/.*`, 'i')
