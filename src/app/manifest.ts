import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/komplain',
    name: 'Laporan Komplain',
    short_name: 'Komplain',
    description: 'Pencatatan kendala lapangan dan rekap komplain mingguan.',
    lang: 'id',
    start_url: '/komplain',
    scope: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    prefer_related_applications: false,
    icons: [
      { src: '/icons/komplain-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/komplain-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/komplain-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
