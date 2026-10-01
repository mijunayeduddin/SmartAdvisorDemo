import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
        critical: {
          DEFAULT: "#f59e0b",
          light: "#fef3c7",
          glow: "#fbbf24",
          dark: "#b45309",
        },
        milestone: {
          DEFAULT: "#8b5cf6",
          light: "#ede9fe",
        },
        surface: {
          900: "#090d16",
          850: "#0f172a",
          800: "#1e293b",
          700: "#334155",
          600: "#475569",
        }
      },
      boxShadow: {
        "glow-critical": "0 0 20px -2px rgba(245, 158, 11, 0.45)",
        "glow-brand": "0 0 20px -2px rgba(99, 102, 241, 0.4)",
        "glow-emerald": "0 0 20px -2px rgba(16, 185, 129, 0.4)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "bounce-slight": "bounceSlight 2s ease-in-out infinite",
      },
      keyframes: {
        bounceSlight: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        }
      }
    },
  },
  plugins: [],
};
export default config;
