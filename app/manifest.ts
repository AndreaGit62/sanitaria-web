import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'VisiLab',
    short_name: 'VisiLab',
    description: 'La tua agenda della salute: visite, documenti e promemoria.',
    lang: 'it',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f6f8fa',
    theme_color: '#245f53',
    icons: [
      {src:'/icons/visilab-192.png',sizes:'192x192',type:'image/png'},
      {src:'/icons/visilab-512.png',sizes:'512x512',type:'image/png'},
      {src:'/icons/visilab-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'},
    ],
  };
}
