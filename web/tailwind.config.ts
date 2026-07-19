import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./contexts/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Muted sage used for highlights: active nav pill, selection, etc.
        accent: "#6f9c7f",
      },
    },
  },
  plugins: [],
};

export default config;
