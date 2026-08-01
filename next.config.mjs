/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Windows local builds use the standard output because Next's standalone
  // trace copier is not reliable there. The Linux container opts in explicitly.
  ...(process.env.NEXT_STANDALONE === 'true' ? { output: 'standalone' } : {})
};

export default nextConfig;
