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
          bg: "#0A0A0A",
          card: "#141414",
          accent: "#FF9F1C",
          text: "#E8E8E8",
          muted: "#8A8A8A",
          border: "#2A2A2A"
        },
        positive: "#00D964",
        negative: "#FF3B3B"
      },
      fontFamily: {
        sans: ["var(--font-fira-sans)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      }
    },
  },
  plugins: [],
};
export default config;
