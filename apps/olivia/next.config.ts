import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@casa/view-as', '@casa/boot'],
  basePath: '/olivia',
}

export default nextConfig
