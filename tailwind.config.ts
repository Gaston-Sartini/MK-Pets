import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        mk: {
          orange:        '#E8760A',
          'orange-dark': '#C45F00',
          'orange-light':'#FFF0E0',
          green:         '#2D6A2D',
          'green-pale':  '#F0FAF0',
          dark:          '#1A1A2E',
          mid:           '#5C5C6B',
          light:         '#F5EFE6',
          white:         '#FAFAF8',
          navy:          '#16213E',
          error:         '#E53E3E',
          success:       '#38A169',
        },
      },
      fontFamily: {
        display: ['var(--font-nunito)', 'sans-serif'],
        body:    ['var(--font-inter)',  'sans-serif'],
      },
      borderRadius: {
        pill:   '50px',
        card:   '16px',
        chip:   '12px',
      },
      boxShadow: {
        card:        '0 4px 20px rgba(0,0,0,0.08)',
        'card-hover':'0 8px 32px rgba(0,0,0,0.14)',
        drawer:      '-8px 0 40px rgba(0,0,0,0.15)',
        navbar:      '0 2px 12px rgba(0,0,0,0.08)',
      },
      keyframes: {
        slideInRight: {
          '0%':   { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        bounceBadge: {
          '0%, 100%': { transform: 'scale(1)' },
          '30%':      { transform: 'scale(1.5)' },
          '60%':      { transform: 'scale(0.9)' },
        },
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in':        'fadeIn 0.2s ease-out',
        'bounce-badge':   'bounceBadge 0.4s cubic-bezier(0.36,0.07,0.19,0.97)',
      },
    },
  },
  plugins: [],
}

export default config
