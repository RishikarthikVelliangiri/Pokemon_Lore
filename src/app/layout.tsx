import type { Metadata, Viewport } from "next";
import { Press_Start_2P, Pixelify_Sans } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

const display = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const text = Pixelify_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LoreDex - Which Pokémon fits your description?",
  description:
    "Describe a Pokémon in your own words and LoreDex tells you which one fits best, with the lore reasoning behind it.",
  keywords: ["pokemon", "pokedex", "ai", "search", "lore"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e1118",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <main className="stage">{children}</main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
