import { promises as fs } from 'fs'
import fg from 'fast-glob'

const font = 'https://fonts.googleapis.com/css2?family=Readex+Pro:wght@200;400;600&display=swap'

const googleapis = 'https://fonts.googleapis.com'
const gstatic = 'https://fonts.gstatic.com'
const jsdelivr = 'https://cdn.jsdelivr.net/'
const antfu = 'https://antfu.me'
const patak = 'https://patak.dev'
const github = 'https://github.com'
const avatars = 'https://avatars.githubusercontent.com'

const preconnect = `
    <link rel="dns-prefetch" href="${googleapis}">
    <link rel="dns-prefetch" href="${gstatic}">
    <link rel="preconnect" crossorigin="anonymous" href="${googleapis}">
    <link rel="preconnect" crossorigin="anonymous" href="${gstatic}">
`
const preconnectHome = `
    <link rel="dns-prefetch" href="${googleapis}">
    <link rel="dns-prefetch" href="${gstatic}">
    <link rel="dns-prefetch" href="${antfu}">
    <link rel="dns-prefetch" href="${patak}">
    <link rel="dns-prefetch" href="${jsdelivr}">
    <link rel="dns-prefetch" href="${github}">
    <link rel="dns-prefetch" href="${avatars}">
    <link rel="preconnect" crossorigin="anonymous" href="${googleapis}">
    <link rel="preconnect" crossorigin="anonymous" href="${gstatic}">
    <link rel="preconnect" crossorigin="anonymous" href="${antfu}">
    <link rel="preconnect" crossorigin="anonymous" href="${patak}">
    <link rel="preconnect" crossorigin="anonymous" href="${jsdelivr}">
    <link rel="preconnect" crossorigin="anonymous" href="${github}">
    <link rel="preconnect" crossorigin="anonymous" href="${avatars}">
`

export const optimizePages = async() => {
  const names = await fg('./.vitepress/dist/**/*.html', { onlyFiles: true })

  await Promise.all(names.map(async(i) => {
    let html = await fs.readFile(i, 'utf-8')

    let preloadImg = '\n\t<link rel="prefetch" href="/logo.svg" crossorigin="anonymous">'

    let usePreconnect = preconnect

    if (i.endsWith('/dist/index.html')) {
      usePreconnect = preconnectHome
      preloadImg = `
${preloadImg}
\t<link rel="prefetch" href="/netlify.svg">
\t<link rel="prefetch" href="/bg.png">
\t<link rel="prefetch" href="https://antfu.me/avatar.png">
\t<link rel="prefetch" href="https://patak.dev/images/patak.jpg">
\t<link rel="prefetch" href="https://avatars.githubusercontent.com/u/37929992?v=4">
\t<link rel="prefetch" href="https://avatars.githubusercontent.com/u/16173870?v=4">
`
    }

    html = html.replace(
      /<link rel="stylesheet" href="(.*?)">/g,
      `
    ${usePreconnect}
    <link rel="preload" as="style" href="$1" />
    <link rel="stylesheet" href="$1" />
    <link
      rel="preload"
      as="style"
      onload="this.onload=null;this.rel='stylesheet'"
      href="${font}"
    />
    <noscript>
      <link rel="stylesheet" crossorigin="anonymous" href="${font}" />
    </noscript>
    <link rel="prefetch" href="/manifest.webmanifest">${preloadImg}`).trim()

    html = html.replace(
      '</head>',
      '\t<link rel="manifest" href="/manifest.webmanifest">\n<',
    )
    // TODO: dark/light theme, don't remove
    // html = html.replace(
    //   '</head>',
    //   '\t<link rel="manifest" href="/manifest.webmanifest">\n<script>\n'
    //     + '    (function() {\n'
    //     + '      const prefersDark = window.matchMedia && window.matchMedia(\'(prefers-color-scheme: dark)\').matches\n'
    //     + '      const setting = localStorage.getItem(\'color-schema\') || \'auto\'\n'
    //     + '      if (setting === \'dark\' || (prefersDark && setting !== \'light\'))\n'
    //     + '        document.documentElement.classList.toggle(\'dark\', true)\n'
    //     + '    })()\n'
    //     + '  </script></head>',
    // )

    html = html.replace(
      /aria-hidden="true"/gi,
      'tabindex="-1" aria-hidden="true"',
    ).replace(
      /<img class="logo"/gi,
      '<img class="logo" width="31" height="31"',
    )

    await fs.writeFile(i, html, 'utf-8')
  }))
}
