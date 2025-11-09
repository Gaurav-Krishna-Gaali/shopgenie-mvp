/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker deployments
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
}

module.exports = nextConfig

