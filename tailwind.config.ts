import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          income: '#34d399',
          expense: '#f87171',
          saving: '#a78bfa',
          cadena: '#38bdf8',
          platform: '#fb923c',
          debt: '#f87171',
          collection: '#34d399',
        }
      }
    }
  },
  plugins: []
} satisfies Config
