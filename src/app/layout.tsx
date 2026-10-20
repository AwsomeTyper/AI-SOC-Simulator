import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SITREP // AI-SOC TABLETOP EXERCISE (AEGIS vs. VANGUARD)",
  description:
    "50-Participant Frontier AI & Security Operations Center Tabletop Crisis Exercise.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased selection:bg-[#C8322B] selection:text-[#FAF8F3]">
        {children}
      </body>
    </html>
  );
}
