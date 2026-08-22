/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts,scss}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Color palettes map to CSS custom properties set by Angular Material themes
      colors: {
        primary: {
          DEFAULT: 'var(--mat-primary-color)',
          50: 'var(--mat-primary-50)',
          100: 'var(--mat-primary-100)',
          200: 'var(--mat-primary-200)',
          300: 'var(--mat-primary-300)',
          400: 'var(--mat-primary-400)',
          500: 'var(--mat-primary-500)',
          600: 'var(--mat-primary-600)',
          700: 'var(--mat-primary-700)',
          800: 'var(--mat-primary-800)',
          900: 'var(--mat-primary-900)',
        },
        accent: {
          DEFAULT: 'var(--mat-accent-color)',
        },
        warn: {
          DEFAULT: 'var(--mat-warn-color)',
        },
      },
      fontFamily: {
        sans: ['Roboto', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        arabic: ['"Noto Kufi Arabic"', '"Cairo"', 'sans-serif'],
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
  // Safelist dynamic permission/state classes
  safelist: ['rtl', 'ltr', { pattern: /^(bg|text|border)-(primary|accent|warn)/ }],
  corePlugins: {
    // Preflight resets conflict with Angular Material; disable only base styles
    preflight: false,
  },
};
