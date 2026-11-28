import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@casa/view-as', '@casa/boot'],
  basePath: '/cuentas-claras',
}

export default nextConfig
