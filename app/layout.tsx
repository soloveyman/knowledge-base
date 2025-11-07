import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ClientProviders } from "@/components/providers/client-providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const graphik = localFont({
  src: [
    {
      path: "../public/fonts/Graphik-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Graphik-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Graphik-Semibold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/Graphik-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-graphik",
  fallback: ["system-ui", "arial"],
  display: "swap", // Improve FCP by showing fallback font immediately
  preload: true, // Preload critical font
  adjustFontFallback: false, // Disable automatic adjustment to prevent layout shift
});

const graphikMono = localFont({
  src: [
    {
      path: "../public/fonts/Graphik-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-graphik-mono",
  fallback: ["ui-monospace", "monospace"],
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Knowledge Base Platform",
  description: "Employee training and knowledge management system",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to external domains for faster resource loading */}
        <link rel="preconnect" href="https://api.x.ai" />
        <link rel="dns-prefetch" href="https://api.x.ai" />
        {/* Theme script - inline and optimized for FCP */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){const t=localStorage.theme==='dark'||localStorage.theme==='light'?localStorage.theme:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.toggle('dark',t==='dark')})();`,
          }}
        />
      </head>
      <body
        className={`${graphik.variable} ${graphikMono.variable} antialiased overflow-x-hidden`}
        suppressHydrationWarning={true}
      >
        <ClientProviders>
          {children}
        </ClientProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
