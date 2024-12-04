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
      name: 'Stackblitz',
      url: 'https://stackblitz.com',
      img: '/stackblitz.svg',
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
