import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AuthSessionProvider from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { TranslationProvider } from "@/lib/translation-context";
import { Toaster } from "@/components/ui/sonner";

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
});

export const metadata: Metadata = {
  title: "Knowledge Base Platform",
  description: "Employee training and knowledge management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
        className={`${graphik.variable} ${graphikMono.variable} antialiased overflow-x-hidden`}
        suppressHydrationWarning={true}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TranslationProvider>
            <AuthSessionProvider>
              {children}
              <Toaster />
            </AuthSessionProvider>
          </TranslationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
