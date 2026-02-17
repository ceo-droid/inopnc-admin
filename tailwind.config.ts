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
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Apple SD Gothic Neo', 'sans-serif'],
      },
      letterSpacing: {
        'tight': '-0.03em',
        'tighter': '-0.05em',
      },
      lineHeight: {
        'heading': '1.3',
        'body': '1.5',
        'relaxed': '1.6',
      },
      fontSize: {
        'heading': ['clamp(20px, 4vw, 24px)', { lineHeight: '1.3', letterSpacing: '-0.03em', fontWeight: '700' }],
        'heading-mobile': ['clamp(18px, 3.5vw, 20px)', { lineHeight: '1.3', letterSpacing: '-0.03em', fontWeight: '700' }],
        'body': ['clamp(16px, 2.5vw, 15px)', { lineHeight: '1.6', letterSpacing: '-0.03em', fontWeight: '400' }],
        'body-mobile': ['16px', { lineHeight: '1.6', letterSpacing: '-0.03em', fontWeight: '400' }],
        'subtext': ['clamp(14px, 2vw, 14px)', { lineHeight: '1.6', letterSpacing: '-0.03em', fontWeight: '400' }],
        'input-mobile': ['16px', { lineHeight: '1.6', letterSpacing: '-0.03em', fontWeight: '400' }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(174, 76%, 42%)", // #109E97 - 더 깊은 청록색
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
        // 시각적 위계 색상
        heading: {
          DEFAULT: "hsl(var(--heading-color))",
        },
        subtext: {
          DEFAULT: "hsl(var(--subtext-color))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
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
        "kakao": "1.25rem",
        "kakao-lg": "1.5rem",
        "kakao-sm": "1rem",
        "kakao-xs": "0.75rem",
      },
      spacing: {
        "kakao-xs": "0.75rem",
        "kakao-sm": "1rem", 
        "kakao": "1.25rem",
        "kakao-md": "1.5rem",
        "kakao-lg": "2rem",
        "kakao-xl": "2.5rem",
        "kakao-2xl": "3rem",
        "kakao-3xl": "3.5rem",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        neon: "var(--shadow-neon)",
        float: "var(--shadow-float)",
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
        "slide-in-from-top": {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-top": "slide-in-from-top 0.3s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
