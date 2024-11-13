import type { DefaultTheme } from 'vitepress'
import contributorNames from './contributor-names.json'

export interface Contributor {
  name: string
  avatar: string
}

export interface CoreTeam extends DefaultTheme.TeamMember {
  // required to download avatars from GitHub
  github: string
  bluesky?: string
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
  if (tm.bluesky) {
    tm.links.push({ icon: 'bluesky', link: tm.bluesky })
  }

  if (tm.mastodon) {
    tm.links.push({ icon: 'mastodon', link: tm.mastodon })
  }

  if (tm.discord) {
    tm.links.push({ icon: 'discord', link: tm.discord })
  }

  if (tm.youtube) {
    tm.links.push({ icon: 'youtube', link: `https://www.youtube.com/@${tm.youtube}` })
  }

  return tm
}

const plainTeamMembers: CoreTeam[] = [
  {
    avatar: contributorsAvatars['sheremet-va'],
    name: 'Vladimir',
    github: 'sheremet-va',
    bluesky: 'https://bsky.app/profile/erus.dev',
    mastodon: 'https://elk.zone/m.webtoo.ls/@sheremet_va',
    sponsor: 'https://github.com/sponsors/sheremet-va',
    title: 'An open source fullstack developer',
    desc: 'Core team member of Vitest & Vite',
  },
  {
    avatar: contributorsAvatars.antfu,
    name: 'Anthony Fu',
    github: 'antfu',
    bluesky: 'https://bsky.app/profile/antfu.me',
    mastodon: 'https://elk.zone/m.webtoo.ls/@antfu',
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
    bluesky: 'https://bsky.app/profile/ariperkkio.dev',
    mastodon: 'https://elk.zone/m.webtoo.ls/@AriPerkkio',
    sponsor: 'https://github.com/sponsors/AriPerkkio',
    title: 'Open source engineer, working',
    desc: 'Core team member of Vitest',
    org: 'StackBlitz',
    orgLink: 'https://stackblitz.com/',
  },
  {
    avatar: contributorsAvatars['patak-dev'],
    name: 'Patak',
    github: 'patak-dev',
    bluesky: 'https://bsky.app/profile/patak.dev',
    mastodon: 'https://elk.zone/m.webtoo.ls/@patak',
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
    bluesky: 'https://bsky.app/profile/userquin.bsky.social',
    mastodon: 'https://elk.zone/m.webtoo.ls/@userquin',
    title: 'A fullstack and android developer',
    desc: 'Vite\'s fanatical follower',
  },
  {
    avatar: contributorsAvatars['hi-ogawa'],
    name: 'Hiroshi Ogawa',
    github: 'hi-ogawa',
    bluesky: 'https://bsky.app/profile/hiogawa.bsky.social',
    title: 'Open source enthusiast',
    desc: 'Team member of Vitest',
  },
]

const plainTeamEmeritiMembers: CoreTeam[] = [
  {
    avatar: contributorsAvatars.Dunqing,
    name: 'Dunqing',
    github: 'Dunqing',
    title: 'A passionate enthusiast of open source contributions',
    desc: 'Team member of oxc & UnoCSS',
  },
  {
    avatar: contributorsAvatars.Aslemammad,
    name: 'Mohammad Bagher',
    github: 'Aslemammad',
    bluesky: 'https://bsky.app/profile/aslemammad.bsky.social',
    mastodon: 'https://elk.zone/m.webtoo.ls/@aslemammad',
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
    avatar: contributorsAvatars.poyoho,
    name: 'Yoho Po',
    github: 'poyoho',
    title: 'It\'s no problem in my locall',
    desc: 'Core team member of Vite & Team member of Vitest',
  },
  {
    avatar: contributorsAvatars.zxch3n,
    name: 'Zixuan Chen',
    github: 'zxch3n',
    bluesky: 'https://bsky.app/profile/zxch3n.bsky.social',
    mastodon: 'https://elk.zone/hachyderm.io/@zx',
    title: 'A fullstack developer',
    desc: 'Working on CRDTs & local-first software',
  },
]

const teamMembers = plainTeamMembers.map(tm => createLinks(tm))
const teamEmeritiMembers = plainTeamEmeritiMembers.map(tm => createLinks(tm))

export { teamEmeritiMembers, teamMembers }
