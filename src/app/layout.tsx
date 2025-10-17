import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "Pokémon Lore Engine - Discover Pokémon through AI",
  description: "Use natural language to discover Pokémon based on their lore, characteristics, and backstory. Powered by AI and comprehensive Pokémon data.",
  keywords: ["pokemon", "ai", "search", "lore", "pokedex", "discovery"],
  authors: [{ name: "Pokémon Lore Engine" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#D93F3F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <main className="pokedex-main">
            <div className="pokedex-hinge"></div>
            <header className="pokedex-header">
              <div className="camera-lens"></div>
              <div className="lights">
                <div className="light red"></div>
                <div className="light yellow"></div>
                <div className="light green"></div>
              </div>
            </header>
            <div className="screen-container">
              {children}
            </div>
            <footer className="control-panel">
              <div className="d-pad"></div>
              <div className="speaker-grill">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="speaker-hole"></div>
                ))}
              </div>
              <div className="action-buttons">
                <div className="action-button"></div>
                <div className="action-button round"></div>
              </div>
            </footer>
          </main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
