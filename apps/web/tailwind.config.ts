import type { Config } from "tailwindcss";

const neuShadowLight = "rgba(255, 255, 255, 0.55)";
const neuShadowDark = "rgb(163, 177, 198, 0.65)";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#E0E5EC",
        foreground: "#171717",
        muted: "#6B7280",
        placeholder: "#A0AEC0",
        accent: {
          DEFAULT: "#F97316",
          light: "#FB923C",
          dark: "#EA580C",
          soft: "#FFEDD5",
        },
        success: "#38B2AC",
        black: "#0A0A0A",
        white: "#FFFFFF",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        neu: "32px",
        "neu-sm": "16px",
      },
      boxShadow: {
        neu: `9px 9px 16px ${neuShadowDark}, -9px -9px 16px ${neuShadowLight}`,
        "neu-hover": `12px 12px 20px rgb(163, 177, 198, 0.7), -12px -12px 20px rgba(255, 255, 255, 0.6)`,
        "neu-sm": `5px 5px 10px ${neuShadowDark}, -5px -5px 10px ${neuShadowLight}`,
        "neu-inset": `inset 6px 6px 10px ${neuShadowDark}, inset -6px -6px 10px ${neuShadowLight}`,
        "neu-inset-deep": `inset 10px 10px 20px rgb(163, 177, 198, 0.7), inset -10px -10px 20px rgba(255, 255, 255, 0.6)`,
        "neu-inset-sm": `inset 3px 3px 6px ${neuShadowDark}, inset -3px -3px 6px ${neuShadowLight}`,
        "neu-accent": `9px 9px 16px rgba(234, 88, 12, 0.35), -9px -9px 16px rgba(255, 237, 213, 0.5)`,
        "neu-accent-hover": `12px 12px 20px rgba(234, 88, 12, 0.45), -12px -12px 20px rgba(255, 237, 213, 0.55)`,
      },
      transitionDuration: {
        neu: "300ms",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        float: "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
