interface Sponsor {
  name: string
  img: string
  url: string
}

const vitestSponsors = {
  special: [
    {
      name: 'VoidZero',
      url: 'https://voidzero.dev',
      img: '/voidzero.svg',
    },
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
      name: 'Bit',
      url: 'https://bit.dev',
      img: '/bit.svg',
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
  ],
} satisfies Record<string, Sponsor[]>

export const sponsors = [
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
