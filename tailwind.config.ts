import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pokedex: {
          red: "var(--pokedex-red)",
          "red-dark": "var(--pokedex-red-dark)",
          "red-light": "var(--pokedex-red-light)",
          blue: "var(--pokedex-blue)",
          "blue-dark": "var(--pokedex-blue-dark)",
          "blue-light": "var(--pokedex-blue-light)",
          black: "var(--pokedex-black)",
          gray: "var(--pokedex-gray)",
          "gray-light": "var(--pokedex-gray-light)",
          white: "var(--pokedex-white)",
          screen: "var(--screen-bg)",
          "screen-dark": "var(--screen-border)",
        },
        pokemon: {
          normal: "#A8A878",
          fire: "#F08030",
          water: "#6890F0",
          electric: "#F8D030",
          grass: "#78C850",
          ice: "#98D8D8",
          fighting: "#C03028",
          poison: "#A040A0",
          ground: "#E0C068",
          flying: "#A890F0",
          psychic: "#F85888",
          bug: "#A8B820",
          rock: "#B8A038",
          ghost: "#705898",
          dragon: "#7038F8",
          dark: "#705848",
          steel: "#B8B8D0",
          fairy: "#EE99AC",
        },
      },
      fontFamily: {
        sans: ['Pokemon DS', "sans-serif"],
        mono: ['Pokemon DS', "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.5s ease-out",
        "pulse-slow": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;