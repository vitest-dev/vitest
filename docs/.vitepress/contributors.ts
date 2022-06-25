import contributorNames from './contributor-names.json'

export interface Contributor {
  name: string
  avatar: string
}

export interface SocialEntry {
  icon: string
  link: string
}

export interface CoreTeam {
  avatar: string
  name: string
  sponsor?: string
  title?: string
  org?: string
  desc?: string
  links?: SocialEntry[]
}

const contributorsAvatars: Record<string, string> = {}

const getAvatarUrl = (name: string) => import.meta.hot ? `https://github.com/${name}.png` : `/user-avatars/${name}.png`

export const contributors = (contributorNames as string[]).reduce((acc, name) => {
  contributorsAvatars[name] = getAvatarUrl(name)
  acc.push({ name, avatar: contributorsAvatars[name] })
  return acc
}, [] as Contributor[])

const createLinks = (entries: string[][]): SocialEntry[] => {
  return entries.reduce((acc, e) => {
    for (let i = 0; i < e.length; i += 2) {
      switch (e[i]) {
        case 'github':
          acc.push({ icon: e[i], link: `https://github.com/${e[i + 1]}` })
          break
        case 'twitter':
          acc.push({ icon: e[i], link: `https://twitter.com/${e[i + 1]}` })
          break
      }
    }
    return acc
  }, new Array<SocialEntry>())
}

export const teamMembers: CoreTeam[] = [
  {
    avatar: contributorsAvatars.antfu,
    name: 'Anthony Fu',
    links: createLinks([['github', 'antfu'], ['twitter', 'antfu7']]),
    sponsor: 'https://github.com/sponsors/antfu',
    title: 'A fanatical open sourceror, working',
    org: 'NuxtLabs',
    desc: 'Core team member of Vite & Vue & Vitest',
  },
  {
    avatar: contributorsAvatars['sheremet-va'],
    name: 'Vladimir',
    links: createLinks([['github', 'sheremet-va'], ['twitter', 'sheremet_va']]),
    title: 'An open source fullstack developer',
    desc: 'Core team member of Vitest',
  },
  {
    avatar: contributorsAvatars['patak-dev'],
    name: 'Patak',
    links: createLinks([['github', 'patak-dev'], ['twitter', 'patak_dev']]),
    sponsor: 'https://github.com/sponsors/dev',
    title: 'A collaborative being, working',
    org: 'StackBlitz',
    desc: 'Core team member of Vite & Vue & Vitest',
  },
  {
    avatar: contributorsAvatars.Aslemammad,
    name: 'Mohammad Bagher',
    links: createLinks([['github', 'Aslemammad'], ['twitter', 'asleMammadam']]),
    title: 'An open source developer',
    desc: 'Team member of Poimandres & Vike',
  },
  {
    avatar: contributorsAvatars.Demivan,
    name: 'Ivan Demchuk',
    links: createLinks([['github', 'Demivan'], ['twitter', 'IvanDemchuk']]),
    title: 'A tech lead, fullstack developer',
    desc: 'Author of fluent-vue',
  },
  {
    avatar: contributorsAvatars.userquin,
    name: 'Joaquín Sánchez',
    links: createLinks([['github', 'userquin'], ['twitter', 'userquin']]),
    title: 'A fullstack and android developer',
    desc: 'Vite\'s fanatical follower',
  },
  {
    avatar: contributorsAvatars.zxch3n,
    name: 'Zixuan Chen',
    links: createLinks([['github', 'zxch3n'], ['twitter', 'zxch3n']]),
    title: 'A fullstack developer',
    desc: 'Creating tools for collaboration',
  },
]
