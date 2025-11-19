import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/providers/client-providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: false, // Don't preload Inter since Graphik is primary
});

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
  fallback: ["Inter", "system-ui", "arial"],
  display: "swap", // Improve FCP by showing fallback font immediately
  // preload is handled automatically by Next.js (only preloads first font file)
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
  preload: false, // Disable preload since this is the same file as graphik (already preloaded)
});

export const metadata: Metadata = {
  title: "Uppstaff | AI Training & Knowledge Platform",
  description: "Manage corporate learning in one place. Upload documents, generate AI-powered tests, assign training to teams, and track progress in real time — fast, transparent, and secure.",
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
        {/* Font preloading is handled automatically by next/font */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function getThemePreference() {
                  if (localStorage.theme === 'dark' || localStorage.theme === 'light') {
                    return localStorage.theme;
                  }
                  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                const theme = getThemePreference();
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${graphik.variable} ${graphikMono.variable} ${inter.variable} antialiased overflow-x-hidden`}
        suppressHydrationWarning={true}
      >
        <ClientProviders>
          {children}
        </ClientProviders>
        {process.env.VERCEL && <Analytics />}
        {process.env.VERCEL && <SpeedInsights />}
      </body>
    </html>
  );
}
