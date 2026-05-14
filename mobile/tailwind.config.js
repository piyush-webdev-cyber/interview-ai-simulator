/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        muted: "#64748B",
        panel: "#F8FAFC",
        brand: "#2563EB",
        success: "#059669",
        warning: "#D97706"
      }
    }
  },
  plugins: []
};
