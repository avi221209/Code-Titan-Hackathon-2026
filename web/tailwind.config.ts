import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg-canvas)',
        foreground: 'var(--text-ink)',
        card: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text-ink)',
        },
        popover: {
          DEFAULT: 'var(--bg-surface)',
          foreground: 'var(--text-ink)',
        },
        primary: {
          DEFAULT: 'var(--accent-teal)',
          foreground: 'var(--accent-teal-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--bg-muted)',
          foreground: 'var(--text-ink)',
        },
        muted: {
          DEFAULT: 'var(--bg-muted)',
          foreground: 'var(--text-muted)',
        },
        accent: {
          DEFAULT: 'var(--bg-accent)',
          foreground: 'var(--accent-teal)',
        },
        destructive: {
          DEFAULT: 'var(--sev-critical-fg)',
          foreground: '#FFFFFF',
        },
        border: 'var(--border-subtle)',
        input: 'var(--border-subtle)',
        ring: 'var(--focus-ring)',
        severity: {
          critical: {
            fg: 'var(--sev-critical-fg)',
            bg: 'var(--sev-critical-bg)',
            border: 'var(--sev-critical-border)',
          },
          high: {
            fg: 'var(--sev-high-fg)',
            bg: 'var(--sev-high-bg)',
            border: 'var(--sev-high-border)',
          },
          medium: {
            fg: 'var(--sev-medium-fg)',
            bg: 'var(--sev-medium-bg)',
            border: 'var(--sev-medium-border)',
          },
          low: {
            fg: 'var(--sev-low-fg)',
            bg: 'var(--sev-low-bg)',
            border: 'var(--sev-low-border)',
          },
        },
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      spacing: {
        'space-1': 'var(--space-1)',
        'space-2': 'var(--space-2)',
        'space-3': 'var(--space-3)',
        'space-4': 'var(--space-4)',
        'space-6': 'var(--space-6)',
        'space-8': 'var(--space-8)',
        'space-12': 'var(--space-12)',
        'space-16': 'var(--space-16)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
    },
  },
  plugins: [],
};

export default config;
