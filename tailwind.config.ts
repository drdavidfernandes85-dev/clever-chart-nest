import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Proxima Nova', 'Poppins', 'Arial', 'system-ui', 'sans-serif'],
        heading: ['Proxima Nova', 'Poppins', 'Arial', 'system-ui', 'sans-serif'],
        proxima: ['Proxima Nova', 'Arial', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        'ix-glow': 'none',
        'ix-card': '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
      },
      colors: {
        // Official INFINOX brand palette (literal hex)
        'ix-yellow': '#FFCD05',
        'ix-charcoal': '#1E1E1E',
        'ix-black': '#1D1D1B',
        'ix-white': '#FFFFFF',
        'ix-light-gray': '#F5F5F5',
        'ix-yellow-100': '#FFCD05',
        'ix-yellow-200': '#FFDB4D',
        'ix-yellow-300': '#FFE680',
        // Semantic tokens (themeable via index.css)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        ember: {
          "0%": { transform: "translate(0, 0) scale(1)", opacity: "0" },
          "10%": { opacity: "1" },
          "100%": { transform: "translate(40px, -120px) scale(0.3)", opacity: "0" },
        },
        comet: {
          "0%": { transform: "translateX(-100%) translateY(-50%) scaleX(0.6)", opacity: "0" },
          "20%": { opacity: "1" },
          "100%": { transform: "translateX(20%) translateY(-50%) scaleX(1)", opacity: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.7", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.025)" },
        },
        "flame-flicker": {
          "0%, 100%": { transform: "scaleX(1) scaleY(1) translateX(0)", opacity: "0.85" },
          "25%": { transform: "scaleX(1.08) scaleY(0.92) translateX(-4px)", opacity: "1" },
          "50%": { transform: "scaleX(0.95) scaleY(1.06) translateX(2px)", opacity: "0.95" },
          "75%": { transform: "scaleX(1.04) scaleY(0.97) translateX(-2px)", opacity: "1" },
        },
        "flame-stream": {
          "0%": { transform: "translateX(-30%) scaleX(0.8)", opacity: "0" },
          "15%": { opacity: "0.9" },
          "85%": { opacity: "0.6" },
          "100%": { transform: "translateX(40%) scaleX(1.2)", opacity: "0" },
        },
        "spark-rise": {
          "0%": { transform: "translate(0,0) scale(1)", opacity: "0" },
          "10%": { opacity: "1" },
          "100%": { transform: "translate(var(--sx,60px), var(--sy,-180px)) scale(0.2)", opacity: "0" },
        },
        "particle-drift": {
          "0%, 100%": { transform: "translate(0,0)", opacity: "0.3" },
          "50%": { transform: "translate(var(--dx,30px), var(--dy,-40px))", opacity: "0.8" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.7s ease-out",
        float: "float 6s ease-in-out infinite",
        ember: "ember 7s ease-out infinite",
        comet: "comet 3.5s ease-out infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "spin-slow": "spin-slow 40s linear infinite",
        breathe: "breathe 5s ease-in-out infinite",
        "flame-flicker": "flame-flicker 1.4s ease-in-out infinite",
        "flame-stream": "flame-stream 2.8s ease-in-out infinite",
        "spark-rise": "spark-rise 3.5s ease-out infinite",
        "particle-drift": "particle-drift 8s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
