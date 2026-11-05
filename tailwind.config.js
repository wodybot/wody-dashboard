module.exports = {
    darkMode: ["class"],
    content: [
      './pages/**/*.{js,jsx}',
      './components/**/*.{js,jsx}',
      './app/**/*.{js,jsx}',
      './src/**/*.{js,jsx}',
    ],
    prefix: "",
    theme: {
      container: {
        center: true,
        padding: '2rem',
        screens: {
          '2xl': '1400px'
        }
      },
      extend: {
        colors: {
          border: 'hsl(var(--border))',
          input: 'hsl(var(--input))',
          ring: 'hsl(var(--ring))',
          background: 'hsl(var(--background))',
          foreground: 'hsl(var(--foreground))',
          primary: {
            DEFAULT: 'hsl(var(--primary))',
            foreground: 'hsl(var(--primary-foreground))'
          },
          secondary: {
            DEFAULT: 'hsl(var(--secondary))',
            foreground: 'hsl(var(--secondary-foreground))'
          },
          destructive: {
            DEFAULT: 'hsl(var(--destructive))',
            foreground: 'hsl(var(--destructive-foreground))'
          },
          muted: {
            DEFAULT: 'hsl(var(--muted))',
            foreground: 'hsl(var(--muted-foreground))'
          },
          accent: {
            DEFAULT: 'hsl(var(--accent))',
            foreground: 'hsl(var(--accent-foreground))'
          },
          popover: {
            DEFAULT: 'hsl(var(--popover))',
            foreground: 'hsl(var(--popover-foreground))'
          },
          card: {
            DEFAULT: 'hsl(var(--card))',
            foreground: 'hsl(var(--card-foreground))'
          },
          chart: {
            '1': 'hsl(var(--chart-1))',
            '2': 'hsl(var(--chart-2))',
            '3': 'hsl(var(--chart-3))',
            '4': 'hsl(var(--chart-4))',
            '5': 'hsl(var(--chart-5))'
          },
          sidebar: {
            DEFAULT: 'hsl(var(--sidebar-background))',
            foreground: 'hsl(var(--sidebar-foreground))',
            primary: 'hsl(var(--sidebar-primary))',
            'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
            accent: 'hsl(var(--sidebar-accent))',
            'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
            border: 'hsl(var(--sidebar-border))',
            ring: 'hsl(var(--sidebar-ring))'
          }
        },
        borderRadius: {
          lg: 'var(--radius)',
          md: 'calc(var(--radius) - 2px)',
          sm: 'calc(var(--radius) - 4px)'
        },
        keyframes: {
          'accordion-down': {
            from: {
              height: '0'
            },
            to: {
              height: 'var(--radix-accordion-content-height)'
            }
          },
          'accordion-up': {
            from: {
              height: 'var(--radix-accordion-content-height)'
            },
            to: {
              height: '0'
            }
          },
          'status-ring': {
            '0%': { transform: 'scale(0.9)', opacity: '0.55' },
            '100%': { transform: 'scale(2.2)', opacity: '0' }
          },
          'status-glow': {
            '0%, 100%': { opacity: '0.6' },
            '50%': { opacity: '1' }
          },
          'idle-glow': {
            '0%, 100%': { transform: 'scale(0.85)', opacity: '0.35' },
            '50%': { transform: 'scale(1.05)', opacity: '0.7' }
          },
          'typing-dot': {
            '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.5' },
            '30%': { transform: 'translateY(-3px)', opacity: '1' }
          },
          shimmer: {
            '0%': { backgroundPosition: '150% 0' },
            '100%': { backgroundPosition: '-50% 0' }
          },
          'wave-text': {
            '0%, 100%': { transform: 'translateY(0)', opacity: '0.55' },
            '50%': { transform: 'translateY(-3px)', opacity: '1' }
          },
          'caret-blink': {
            '0%, 45%': { opacity: '1' },
            '50%, 95%': { opacity: '0' },
            '100%': { opacity: '1' }
          },
          'thumb-pop-on': {
            '0%': { transform: 'translateX(0) scale(1)' },
            '40%': { transform: 'translateX(0.65rem) scale(0.75)' },
            '70%': { transform: 'translateX(1.35rem) scale(1.15)' },
            '100%': { transform: 'translateX(1rem) scale(1)' }
          },
          'thumb-pop-off': {
            '0%': { transform: 'translateX(1rem) scale(1)' },
            '40%': { transform: 'translateX(0.35rem) scale(0.75)' },
            '70%': { transform: 'translateX(-0.15rem) scale(1.15)' },
            '100%': { transform: 'translateX(0) scale(1)' }
          },
          'toggle-glow': {
            '0%': { boxShadow: '0 0 0 0 rgba(230, 205, 140, 0.55)' },
            '70%': { boxShadow: '0 0 0 6px rgba(230, 205, 140, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(230, 205, 140, 0)' }
          },
          'marquee-left': {
            '0%': { transform: 'translateX(0)' },
            '100%': { transform: 'translateX(-50%)' }
          },
          'marquee-right': {
            '0%': { transform: 'translateX(-50%)' },
            '100%': { transform: 'translateX(0)' }
          }
        },
        animation: {
          'accordion-down': 'accordion-down 0.2s ease-out',
          'accordion-up': 'accordion-up 0.2s ease-out',
          'status-ring': 'status-ring 2.4s cubic-bezier(0.2, 0.6, 0.35, 1) infinite',
          'status-glow': 'status-glow 2.4s ease-in-out infinite',
          'idle-glow': 'idle-glow 2.8s ease-in-out infinite',
          'typing-dot': 'typing-dot 1.4s ease-in-out infinite',
          shimmer: 'shimmer 2.8s linear infinite',
          'wave-text': 'wave-text 1.6s ease-in-out infinite',
          'caret-blink': 'caret-blink 1.1s step-end infinite',
          'thumb-pop-on': 'thumb-pop-on 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          'thumb-pop-off': 'thumb-pop-off 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          'toggle-glow': 'toggle-glow 0.5s ease-out',
          'marquee-left': 'marquee-left 42s linear infinite',
          'marquee-right': 'marquee-right 42s linear infinite'
        }
      }
    },
    plugins: [require("tailwindcss-animate")],
  }