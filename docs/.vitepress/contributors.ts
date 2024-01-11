import type { DefaultTheme } from 'vitepress'
import contributorNames from './contributor-names.json'

export interface Contributor {
  name: string
  avatar: string
}

export interface CoreTeam extends DefaultTheme.TeamMember {
  // required to download avatars from GitHub
  github: string
  twitter?: string
  mastodon?: string
  discord?: string
  youtube?: string
}

const contributorsAvatars: Record<string, string> = {}

function getAvatarUrl(name: string) {
  return import.meta.hot ? `https://github.com/${name}.png` : `/user-avatars/${name}.png`
}

export const contributors = (contributorNames).reduce<Contributor[]>((acc, name) => {
  contributorsAvatars[name] = getAvatarUrl(name)
  acc.push({ name, avatar: contributorsAvatars[name] })
  return acc
}, [])

function createLinks(tm: CoreTeam): CoreTeam {
  tm.links = [{ icon: 'github', link: `https://github.com/${tm.github}` }]
  if (tm.mastodon)
    tm.links.push({ icon: 'mastodon', link: tm.mastodon })

  if (tm.discord)
    tm.links.push({ icon: 'discord', link: tm.discord })

  if (tm.youtube)
    tm.links.push({ icon: 'youtube', link: `https://www.youtube.com/@${tm.youtube}` })

  if (tm.twitter)
    tm.links.push({ icon: 'x', link: `https://twitter.com/${tm.twitter}` })

  return tm
}

const plainTeamMembers: CoreTeam[] = [
  {
    avatar: contributorsAvatars['sheremet-va'],
    name: 'Vladimir',
    github: 'sheremet-va',
    mastodon: 'https://elk.zone/m.webtoo.ls/@sheremet_va',
    twitter: 'sheremet_va',
    sponsor: 'https://github.com/sponsors/sheremet-va',
    title: 'An open source fullstack developer',
    desc: 'Core team member of Vitest & Vite',
  },
  {
    avatar: contributorsAvatars.antfu,
    name: 'Anthony Fu',
    github: 'antfu',
    mastodon: 'https://elk.zone/m.webtoo.ls/@antfu',
    twitter: 'antfu7',
    discord: 'https://chat.antfu.me',
    youtube: 'antfu',
    sponsor: 'https://github.com/sponsors/antfu',
    title: 'A fanatical open sourceror, working',
    org: 'NuxtLabs',
    orgLink: 'https://nuxtlabs.com/',
    desc: 'Core team member of Vite & Vue',
  },
  {
    avatar: contributorsAvatars.AriPerkkio,
    name: 'Ari Perkkiö',
    github: 'AriPerkkio',
    mastodon: 'https://elk.zone/m.webtoo.ls/@AriPerkkio',
    twitter: 'ari_perkkio',
    sponsor: 'https://github.com/sponsors/AriPerkkio',
    title: 'A fullstack developer, working',
    desc: 'Core team member of Vitest',
    org: 'Cloudamite',
    orgLink: 'https://cloudamite.com/',
  },
  {
    avatar: contributorsAvatars['patak-dev'],
    name: 'Patak',
    github: 'patak-dev',
    mastodon: 'https://elk.zone/m.webtoo.ls/@patak',
    twitter: 'patak_dev',
    sponsor: 'https://github.com/sponsors/patak-dev',
    title: 'A collaborative being, working',
    org: 'StackBlitz',
    orgLink: 'https://stackblitz.com/',
    desc: 'Core team member of Vite & Vue',
  },
  {
    avatar: contributorsAvatars.userquin,
    name: 'Joaquín Sánchez',
    github: 'userquin',
    mastodon: 'https://elk.zone/m.webtoo.ls/@userquin',
    twitter: 'userquin',
    title: 'A fullstack and android developer',
    desc: 'Vite\'s fanatical follower',
  },
  {
    avatar: contributorsAvatars.Dunqing,
    name: 'Dunqing',
    github: 'Dunqing',
    twitter: '@Dunqingg',
    title: 'A passionate enthusiast of open source contributions',
    desc: 'Team member of Vitest & UnoCSS',
  },
  {
    avatar: contributorsAvatars.Aslemammad,
    name: 'Mohammad Bagher',
    github: 'Aslemammad',
    mastodon: 'https://elk.zone/m.webtoo.ls/@aslemammad',
    twitter: 'asleMammadam',
    title: 'An open source developer',
    desc: 'Team member of Poimandres & Vike',
  },
  {
    avatar: contributorsAvatars.Demivan,
    name: 'Ivan Demchuk',
    github: 'Demivan',
    mastodon: 'https://elk.zone/fosstodon.org/@demivan',
    title: 'A tech lead, fullstack developer',
    desc: 'Author of fluent-vue',
  },
  {
    avatar: contributorsAvatars.zxch3n,
    name: 'Zixuan Chen',
    github: 'zxch3n',
    mastodon: 'https://elk.zone/hachyderm.io/@zx',
    twitter: 'zxch3n',
    title: 'A fullstack developer',
    desc: 'Working on CRDTs & local-first software',
  },
  {
    avatar: contributorsAvatars.poyoho,
    name: 'Yoho Po',
    github: 'poyoho',
    twitter: '@yoho_po',
    title: 'It\'s no problem in my locall',
    desc: 'Core team member of Vite & Team member of Vitest',
  },
]

const teamMembers = plainTeamMembers.map(tm => createLinks(tm))

export { teamMembers }
