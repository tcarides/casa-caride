import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@casa/view-as'],
  basePath: '/gastos',
}

export default nextConfig
