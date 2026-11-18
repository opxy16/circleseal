import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Footer, Header, TabBar } from "@/components/shell";
import { WalletProvider } from "@/components/wallet";
import { chain } from "@/lib/config";

// Archivo's width axis gives us one family for both the expanded "engraved" headlines and normal body text.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "CircleSeal · Your savings circle, sealed on-chain",
  description: "Co-signed receipts for the savings groups people already run (ajo, susu, tontine, chama, tanda), and savings circles enforced by code. Built on QIE.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1220" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${plexMono.variable} antialiased`}>
        <a href="#main" className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Skip to content
        </a>
        <WalletProvider>
          {/* Clip decorative overflow here (not on body, which would pass it to the viewport). */}
          <div className="flex min-h-screen flex-col overflow-x-clip">
          <Header network={chain.name} />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-8 sm:px-6 md:pb-20">
            {children}
          </main>
          <Footer network={chain.name} />
          </div>
          <TabBar />
        </WalletProvider>
      </body>
    </html>
  );
}
