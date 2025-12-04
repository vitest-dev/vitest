interface Sponsor {
  name: string
  url: string
  img?: string
}

export const vitestSponsors = {
  special: [
    { name: 'NuxtLabs', url: 'https://nuxtlabs.com' },
    { name: 'Bolt', url: 'https://bolt.new' },
    { name: 'Zammad', url: 'https://zammad.com' },
  ],
  gold: [
    { name: 'Vital', url: 'https://vital.io/' },
    { name: 'OOMOL', url: 'https://oomol.com/' },
    { name: 'Mailmeteor', url: 'https://mailmeteor.com/' },
    { name: 'Liminity', url: 'https://www.liminity.se/' },
    { name: 'Bytebase', url: 'https://www.bytebase.com/' },
  ],
} satisfies Record<string, Sponsor[]>

export const sponsors = [
  {
    tier: 'Special Sponsors',
    size: 'big',
    items: vitestSponsors.special,
  },
  {
    tier: 'Gold Sponsors',
    size: 'medium',
    items: vitestSponsors.gold,
  },
]
