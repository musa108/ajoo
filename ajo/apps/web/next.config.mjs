/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ajo/abi"],
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
