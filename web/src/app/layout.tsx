import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Footer, Header, TabBar } from "@/components/shell";
import { WalletProvider } from "@/components/wallet";
import { chain } from "@/lib/config";

const geistSans = localFont({ src: "./fonts/GeistVF.woff", variable: "--font-geist-sans", weight: "100 900" });
const geistMono = localFont({ src: "./fonts/GeistMonoVF.woff", variable: "--font-geist-mono", weight: "100 900" });

export const metadata: Metadata = {
  title: "AjoProof · Your ajo, verifiable",
  description: "Co-signed thrift receipts nobody can change or deny, and savings circles enforced by code. Built on QIE.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0d" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col overflow-x-clip antialiased`}>
        <WalletProvider>
          <Header network={chain.name} />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-8 md:pb-16">{children}</main>
          <Footer network={chain.name} />
          <TabBar />
        </WalletProvider>
      </body>
    </html>
  );
}
