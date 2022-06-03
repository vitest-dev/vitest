import { promises as fs } from 'fs'
import fg from 'fast-glob'
import { font, preconnectHomeLinks, preconnectLinks } from '../meta'

const preconnect = `
  ${preconnectLinks.map(l => `<link rel="dns-prefetch" href="${l}">`).join('\n')}
  ${preconnectLinks.map(l => `<link rel="preconnect" crossorigin="anonymous" href="${l}">`).join('\n')}
`

const preconnectHome = `
  ${preconnectHomeLinks.map(l => `<link rel="dns-prefetch" href="${l}">`).join('\n')}
  ${preconnectHomeLinks.map(l => `<link rel="preconnect" crossorigin="anonymous" href="${l}">`).join('\n')}
`

export const optimizePages = async (pwa: boolean) => {
  const names = await fg('./.vitepress/dist/**/*.html', { onlyFiles: true })

  await Promise.all(names.map(async (i) => {
    let html = await fs.readFile(i, 'utf-8')

    let prefetchImg = '\n\t<link rel="prefetch" href="/logo.svg">'

    let usePreconnect = preconnect

    if (i.endsWith('/dist/index.html')) {
      usePreconnect = preconnectHome
      prefetchImg = `
${prefetchImg}
\t<link rel="prefetch" href="/netlify.svg">
\t<link rel="prefetch" href="/bg.png">
`
    }

    // we need the font on development, so the font entry is added in vitepress head
    html = html.replace(`<link href="${font.replace('&', '&amp;')}" rel="stylesheet">`, '')

    html = html.replace(
      /<link rel="stylesheet" href="(.*)">/g,
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
    </noscript>`).trim()

    if (pwa) {
      html = html.replace(
        '</head>',
        `
\t<link rel="prefetch" href="/manifest.webmanifest">${prefetchImg}
\t<link rel="manifest" href="/manifest.webmanifest">\n</head>`,
      )
    }
    else {
      html = html.replace(
        '</head>',
        `
${prefetchImg}
</head>`,
      )
    }

    // TODO: dark/light theme, don't remove yet
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
