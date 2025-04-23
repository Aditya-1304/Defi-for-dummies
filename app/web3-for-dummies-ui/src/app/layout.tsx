import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/(ui)/theme-provider";
import { WalletContextProvider } from "@/components/wallet/wallet-provider";
import { NetworkProvider } from "@/components/(ui)/network-context";
import { TokenProvider } from "@/components/(ui)/token-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Defi Buddy",
  description: "Your very own Defi Buddy to help you navigate the world of DeFi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
          <NetworkProvider>
            <WalletContextProvider>
              <TokenProvider>
            {children}
              </TokenProvider>
            </WalletContextProvider>
          </NetworkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}