/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
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
