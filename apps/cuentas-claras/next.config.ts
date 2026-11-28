import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@casa/view-as', '@casa/boot', '@casa/people'],
  basePath: '/cuentas-claras',
}

export default nextConfig
