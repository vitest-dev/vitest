import contributors from '../contributors.json'

export interface Contributor {
  name: string
  avatar: string
}

export interface CoreTeam {
  avatar: string
  name: string
  github: string
  twitter?: string
  sponsors: boolean
  description: string
}

// for antfu sponsors
const jsdelivr = 'cdn.jsdelivr.net'
// for patak sponsors
const patak = 'patak.dev'
const antfuSponsors = `https://${jsdelivr}/gh/antfu/static/sponsors.svg`
const patakSponsors = `https://${patak}/sponsors.svg`

const contributorsAvatars: Record<string, string> = {}

const contributorList = (contributors as string[]).reduce((acc, name) => {
  contributorsAvatars[name] = `https://github.com/${name}.png`
  acc.push({ name, avatar: contributorsAvatars[name] })
  return acc
}, [] as Contributor[])

const coreTeamMembers: CoreTeam[] = [
  {
    avatar: contributorsAvatars.antfu,
    name: 'Anthony Fu',
    github: 'antfu',
    twitter: 'antfu7',
    sponsors: true,
    description: 'A fanatical open sourceror<br>Core team member of Vite & Vue<br>Working at NuxtLabs',
  },
  {
    avatar: contributorsAvatars['patak-dev'],
    name: 'Patak',
    github: 'patak-dev',
    twitter: 'patak-dev',
    sponsors: true,
    description: 'A collaborative being<br>Core team member of Vite<br>Team member of Vue',
  },
  {
    avatar: contributorsAvatars.Aslemammad,
    name: 'Mohammad Bagher',
    github: 'Aslemammad',
    twitter: 'asleMammadam',
    sponsors: false,
    description: 'An open source developer<br>Team member of Poimandres and Vike',
  },
  {
    avatar: contributorsAvatars['sheremet-va'],
    name: 'Vladimir',
    github: 'sheremet-va',
    twitter: 'sheremet_va',
    sponsors: false,
    description: 'An open source fullstack developer',
  },
  {
    avatar: contributorsAvatars.Demivan,
    name: 'Ivan Demchuk',
    github: 'Demivan',
    twitter: 'IvanDemchuk',
    sponsors: false,
    description: 'A tech lead, fullstack developer<br>Author of fluent-vue',
  },
  {
    avatar: contributorsAvatars.userquin,
    name: 'Joaquín Sánchez',
    github: 'userquin',
    twitter: 'userquin',
    sponsors: false,
    description: 'A fullstack and android developer<br>Vite\'s fanatical follower',
  },
]

export { coreTeamMembers, contributorList as contributors, jsdelivr, patak, antfuSponsors, patakSponsors }
