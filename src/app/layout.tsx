import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Lab Crisis Simulator",
  description: "5v5 AI & Cybersecurity Tabletop Simulation",
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
      <body className="min-h-screen dossier-surface text-[#121211] antialiased selection:bg-[#C8322B] selection:text-[#FAF7F0]">
        {children}
      </body>
    </html>
  );
}
