/** @type {import('tailwindcss').Config} */
// Design tokens disalin dari src/styles/tokens.css supaya utility class
// (bg-panel, text-primary, dst.) konsisten dengan variabel CSS native.
// Sumber tunggal tetap tokens.css; ubah di sana lalu mirror nilainya di sini.

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FAF9F7",
        sidebar: "#F4F2EE",
        panel: {
          DEFAULT: "#F9F5EA",
          soft: "#E6DFCB",
          strong: "#D5CCB2",
        },
        ink: {
          DEFAULT: "#1C1A15",
          soft: "#3D3829",
        },
        muted: {
          DEFAULT: "#6E685A",
          2: "#8F8877",
        },
        line: {
          DEFAULT: "#DAD2B9",
          strong: "#C3B99B",
        },
        primary: {
          DEFAULT: "#1E3A5F",
          strong: "#122B4A",
          soft: "#E2E8F1",
        },
        danger: {
          DEFAULT: "#B8473B",
          strong: "#8E2F25",
          soft: "#F4DED7",
        },
        warning: {
          DEFAULT: "#B8841F",
          strong: "#8A6115",
          soft: "#F5E6BD",
        },
        success: {
          DEFAULT: "#3F7D58",
          strong: "#2C5A3F",
          soft: "#D4E5DA",
        },
      },
      borderRadius: {
        DEFAULT: "14px",
        sm: "9px",
      },
      boxShadow: {
        soft: "0 6px 22px rgba(45, 34, 10, 0.06)",
      },
      fontFamily: {
        // Display font masih TBD; pakai Geist sebagai default sampai diputuskan.
        sans: ["Geist", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
