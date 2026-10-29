/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#071224",
          800: "#0c1e38",
          700: "#132c52",
          600: "#1e4070",
        },
        civic: {
          teal: "#0D9488",
          darkTeal: "#0F766E",
          lightTeal: "#14B8A6",
          slate: "#0F172A",
          muted: "#64748B",
        }
      }
    },
  },
  plugins: [],
}
