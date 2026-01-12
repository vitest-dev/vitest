interface Sponsor {
  name: string
  img: string
  url: string
}

const vitestSponsors = {
  provided: [
    {
      name: 'VoidZero',
      url: 'https://voidzero.dev',
      img: '/voidzero.svg',
    },
  ],
  special: [
    {
      name: 'NuxtLabs',
      url: 'https://nuxtlabs.com',
      img: '/nuxtlabs.svg',
    },
    {
      name: 'Bolt',
      url: 'https://bolt.new',
      img: '/bolt.svg',
    },
    {
      name: 'Zammad',
      url: 'https://zammad.com',
      img: '/zammad.svg',
    },
  ],
  platinum: [
    {
      name: 'Chromatic',
      url: 'https://www.chromatic.com/?utm_source=vitest&utm_medium=sponsorship&utm_campaign=vitestSponsorship',
      img: '/logo-chromatic.svg',
    },
  ],
  gold: [
    {
      name: 'vital',
      url: 'https://vital.io/',
      img: '/vital.svg',
    },
    {
      name: 'OOMOL',
      url: 'https://oomol.com/',
      img: '/oomol.svg',
    },
    {
      name: 'Mailmeteor',
      url: 'https://mailmeteor.com/',
      img: '/mailmeteor.svg',
    },
    {
      name: 'Liminity',
      url: 'https://www.liminity.se/',
      img: '/liminity.svg',
    },
  ],
} satisfies Record<string, Sponsor[]>

export const sponsors = [
  {
    tier: 'Brought to you by',
    size: 'big',
    items: vitestSponsors.provided,
  },
  {
    tier: 'Special Sponsors',
    size: 'big',
    items: vitestSponsors.special,
  },
  {
    tier: 'Platinum Sponsors',
    size: 'big',
    items: vitestSponsors.platinum,
  },
  {
    tier: 'Gold Sponsors',
    size: 'medium',
    items: vitestSponsors.gold,
  },
]
