/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    // Generated provider bundles are minified scraper code. Tailwind would
    // harvest junk "class names" out of their string literals and emit CSS that
    // lightningcss then rejects, which fails the whole export.
    "!./src/providers/**",
  ],
  presets: [require("nativewind/preset")], // 👈 THIS IS THE MISSING PIECE
  theme: {
    extend: {
      colors: {
        primary: "#E50914",
        background: "#141414",
        surface: "#1F1F1F",
      },
    },
  },
  plugins: [],
};
