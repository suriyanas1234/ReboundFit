import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#090A0F",
        surface: "#12141C",
        "surface-elevated": "#1A1D27",
        "surface-border": "#262A38",
        brand: {
          cyan: "#00F0FF",
          emerald: "#10B981",
          amber: "#F59E0B",
          rose: "#F43F5E",
          purple: "#8B5CF6",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      spacing: {
        safe: "env(safe-area-inset-bottom, 20px)",
      },
      padding: {
        safe: "env(safe-area-inset-bottom, 20px)",
        "safe-top": "env(safe-area-inset-top, 20px)",
      },
    },
  },
  plugins: [],
};

export default config;
