import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          bg: "#F6F4EF",
          card: "#FCFBF9",
          accent: "#3D6B5C",
          text: "#1C2430",
          muted: "#8A7F6D",
          border: "#DDD8CF",
          warning: "#B7791F",
          critical: "#A13D2D"
        },
        positive: "#4C7A6B",
        negative: "#A13D2D"
      },
      fontFamily: {
        sans: ["var(--font-public-sans)", "sans-serif"],
        serif: ["var(--font-fraunces)", "serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      }
    },
  },
  plugins: [],
};
export default config;
