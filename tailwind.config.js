/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        clay: "#ECE7EA",
        ink: "#3B2B35",
        "ink-2": "#6E5C66",
        "ink-3": "#9A8A93",
        accent: "#FF2A5F",
        "accent-ink": "#C8174A",
        run: "#0F7050",
        hold: "#8F4C00",
      },
      fontFamily: {
        body: ["Manrope", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
