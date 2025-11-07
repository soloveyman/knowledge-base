import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          ...securityHeaders,
          // Performance headers
          {
            key: 'Link',
            value: '</fonts/Graphik-Regular.woff2>; rel=preload; as=font; type=font/woff2; crossorigin=anonymous',
          },
        ],
      },
    ];
  },
  // Request size limits
  experimental: {
    serverActions: {
      bodySizeLimit: '1mb',
    },
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
    ],
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Optimize images
  images: {
    // Modern formats with AVIF first (best compression)
    formats: ['image/avif', 'image/webp'],
    // Optimized device sizes - removed 3840 (rarely needed, increases bundle)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Optimized image sizes for icons/thumbnails
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 1 year cache TTL for better performance (images rarely change)
    minimumCacheTTL: 31536000,
    // Allow SVG with security
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Remote patterns for external images (add domains as needed)
    remotePatterns: [],
  },
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Turbopack optimizations (Next.js 16 uses Turbopack by default)
  turbopack: {},
};

export default nextConfig;
