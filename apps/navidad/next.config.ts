import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: '/navidad',
  transpilePackages: ['@casa/view-as', '@casa/boot'],
}

export default nextConfig
