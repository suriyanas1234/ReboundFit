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
        background: "#000000",
        surface: "#1C1C1E",
        "surface-elevated": "#2C2C2E",
        "surface-border": "#38383A",
        // Apple Health Native Palette
        apple: {
          bg: "#000000",
          card: "#1C1C1E",
          cardHover: "#2C2C2E",
          separator: "#38383A",
          gray: "#8E8E93",
          darkGray: "#636366",
          orange: "#FF9500", // Nutrition / Calories
          pink: "#FF2D55",   // Protein / Activity
          purple: "#AF52DE", // Weight / Measurements
          blue: "#0A84FF",   // Workouts / Hypertrophy
          green: "#30D158",  // Completion / PRs
          teal: "#64D2FF",
          yellow: "#FFD60A",
        },
        brand: {
          cyan: "#0A84FF",
          emerald: "#30D158",
          amber: "#FF9500",
          rose: "#FF2D55",
          purple: "#AF52DE",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "SF Mono",
          "ui-monospace",
          "Menlo",
          "Monaco",
          "monospace",
        ],
      },
      spacing: {
        safe: "env(safe-area-inset-bottom, 20px)",
      },
      padding: {
        safe: "env(safe-area-inset-bottom, 20px)",
        "safe-top": "env(safe-area-inset-top, 20px)",
      },
      borderRadius: {
        "apple-card": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
