import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { PlayerDrawerProvider } from "@/components/PlayerDrawer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FPL Assistant",
  description:
    "Fantasy Premier League form, fixtures, transfer suggestions and best squad builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <PlayerDrawerProvider>
          <Nav />
          <main className="mx-auto max-w-7xl px-4 py-6 md:py-8">{children}</main>
          <footer className="mx-auto max-w-7xl px-4 pb-10 text-center text-xs text-zinc-600">
            Unofficial FPL helper using the public Fantasy Premier League API. Not
            affiliated with the Premier League or FPL.
          </footer>
        </PlayerDrawerProvider>
      </body>
    </html>
  );
}
