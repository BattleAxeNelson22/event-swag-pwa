import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Culver\u2019s Swag Redemption Scanner',
    short_name: 'Swag Scanner',
    description:
      'Scan attendee QR codes to validate and redeem event swag codes.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#003DA5',
    theme_color: '#003DA5',
    categories: ['business', 'utilities'],
    icons: [
      {
        src: '/app-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/app-icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
