import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Zona Multi-Zones: esta app se sirve bajo /casas dentro de Casa Caride.
  basePath: '/casas',
  // Asegura que data/properties.json se incluya en las serverless functions de Vercel
  outputFileTracingIncludes: {
    '/api/**/*': ['./data/**/*'],
  },
  images: {
    remotePatterns: [
      { hostname: 'imgar.zonapropcdn.com' },
      { hostname: 'www.argenprop.com' },
      { hostname: 'http2.mlstatic.com' },
      { hostname: 'mla-s1-p.mlstatic.com' },
      { hostname: 'mla-s2-p.mlstatic.com' },
      { hostname: 'mla-s3-p.mlstatic.com' },
    ],
  },
}

export default nextConfig
