/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "#faf9f9",
        navy: "#1a2b3c",
        navyDeep: "#041627",
        sage: "#98a994",
        sand: "#e8e2d9",
        stone: "#7d7d7d",
        gold: "#c5a059"
      },
      boxShadow: {
        ambient: "0 24px 70px rgba(26, 43, 60, 0.08)",
        frost: "inset 0 1px 0 rgba(255,255,255,.45), 0 20px 60px rgba(26,43,60,.07)"
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "3rem"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
