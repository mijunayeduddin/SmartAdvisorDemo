/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
      {
        source: '/schedule/:path*',
        destination: 'http://localhost:5000/schedule/:path*',
      },
      {
        source: '/courses/:path*',
        destination: 'http://localhost:5000/courses/:path*',
      },
    ];
  },
};

export default nextConfig;
