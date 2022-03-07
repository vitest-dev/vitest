import avatars from '../avatars.json'
import contributors from '../contributors.json'

const useAvatars = avatars as Record<string, Record<string, any>>

export interface Contributor {
  name: string
  avatar: string
}

export interface CoreTeam {
  avatar: string
  name: string
  github: string
  twitter?: string
  sponsors?: boolean
  description: string
}

const jsdelivr = 'cdn.jsdelivr.net'
// antfu sponsors
const antfuSponsors = `https://${jsdelivr}/gh/antfu/static/sponsors.svg`
// patak sponsors
const patakSponsors = `https://${jsdelivr}/gh/patak-dev/static/sponsors.svg`

const contributorsAvatars: Record<string, string> = {}

const getAvatarUrl = (name: string) => {
  // when running the avatars script, avatars.json maybe be empty
  // do not remove this logic, once the avatars.json file is ok this will work as expected
  const avatar = useAvatars && useAvatars[name]
  return avatar ? `/images/${name}${avatar.extension}` : `https://github.com/${name}.png`
}

const contributorList = (contributors as string[]).reduce((acc, name) => {
  contributorsAvatars[name] = getAvatarUrl(name)
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

export { coreTeamMembers, contributorList as contributors, jsdelivr, antfuSponsors, patakSponsors }
