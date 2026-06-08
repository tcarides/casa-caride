/** @type {import('next').NextConfig} */
const nextConfig = {
  // Zona Multi-Zones: esta app se sirve bajo /super dentro de Casa Caride.
  basePath: '/super',
  // El service worker y el manifest los provee el shell (un único PWA).
};

export default nextConfig;
