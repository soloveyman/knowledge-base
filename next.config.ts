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
          // Font preloading is handled automatically by next/font in layout.tsx
        ],
      },
    ];
  },
  // Request size limits
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Increased for documents with images
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
  // Exclude Node.js packages from server component bundling
  serverExternalPackages: [
    'pg',
    'pg-connection-string',
    'drizzle-orm',
  ],
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Enable standalone output for Docker
  output: 'standalone',
  // Optimize images
  images: {
    // Modern formats with AVIF first (best compression)
    formats: ['image/avif', 'image/webp'],
    // Optimized device sizes - removed 3840 (rarely needed, increases bundle)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Optimized image sizes for icons/thumbnails/small images
    // Small images (≤256px): 16, 32, 48, 64, 96, 128, 256
    // Medium images: 384
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Quality levels used throughout the app:
    // 75 - default Next.js quality
    // 85 - regular images (document content)
    // 90 - logos and important images
    // 95 - small images (icons, thumbnails)
    // 100 - QR codes (maximum quality for readability)
    qualities: [75, 85, 90, 95, 100],
    // 1 year cache TTL for better performance (images rarely change)
    minimumCacheTTL: 31536000,
    // Allow SVG with security
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Remote patterns for external images (add domains as needed)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uppstaff.ams3.digitaloceanspaces.com',
      },
      {
        protocol: 'https',
        hostname: 'uppstaff.ams3.cdn.digitaloceanspaces.com',
      },
    ],
    // Small image optimization rules:
    // - Small images (≤256px) use higher quality (95-100) since file size is negligible
    // - QR codes and icons get priority loading and maximum quality
    // - Small images skip blur placeholders (load too fast to be useful)
    // - Exact sizes for small images to avoid unnecessary resizing
  },
  // Disable ESLint during build to avoid flat config issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Webpack configuration to exclude Node.js modules from client-side bundling
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js modules from client-side bundling
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        dns: false,
        child_process: false,
        os: false,
        path: false,
        stream: false,
        util: false,
        buffer: false,
        url: false,
        http: false,
        https: false,
        zlib: false,
      };
      // Exclude optional native dependencies
      config.resolve.alias = {
        ...config.resolve.alias,
        'pg-native': false,
      };
    }
    
    // Optimize webpack cache to reduce serialization warnings
    if (config.cache && typeof config.cache === 'object') {
      config.cache.maxMemoryGenerations = 1;
      config.cache.maxAge = 1000 * 60 * 60 * 24; // 24 hours
    }
    
    return config;
  },
};

export default nextConfig;
