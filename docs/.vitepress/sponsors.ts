import type { SponsorTier } from '@voidzero-dev/vitepress-theme/src/types/sponsors'

export const sponsors: SponsorTier[] = [
  {
    tier: 'Special',
    size: 'big',
    items: [
      {
        name: 'Vercel',
        url: 'https://vercel.com',
        img: '/vercel.svg',
      },
      {
        name: 'Chromatic',
        url: 'https://www.chromatic.com/?utm_source=vitest&utm_medium=sponsorship&utm_campaign=vitestSponsorship',
        img: '/chromatic.svg',
      },
      {
        name: 'Zammad',
        url: 'https://zammad.com',
        img: '/zammad.svg',
      },
    ],
  },
  {
    tier: 'Platinum Sponsors',
    size: 'big',
    items: [

      {
        name: 'Bolt',
        url: 'https://bolt.new',
        img: '/bolt.svg',
      },
    ],
  },
  {
    tier: 'Gold',
    size: 'medium',
    items: [
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
      {
        name: 'Aerius Ventilation',
        url: 'https://aerius.se/',
        img: '/aerius.png',
      },
    ],
  },
]
