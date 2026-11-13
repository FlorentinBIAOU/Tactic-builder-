import animate from 'tailwindcss-animate';

/** TACTIC admin design tokens. Colours come from CSS variables defined in
 *  src/styles/app.css (dark = default, light via [data-theme="light"]). */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        background: v('background'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        border: v('border'),
        input: v('input'),
        foreground: v('foreground'),
        muted: v('muted'),
        primary: { DEFAULT: v('primary'), foreground: v('primary-foreground') },
        brand: { DEFAULT: v('brand'), soft: v('brand-soft') },
        success: v('success'),
        danger: v('danger'),
        warning: v('warning'),
        info: v('info'),
        ring: v('ring'),
      },
      fontFamily: {
        sans: ['"Instrument Sans Variable"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        brand: ['Bungee', '"Instrument Sans Variable"', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.375rem' }],
        md: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.625rem' }],
        xl: ['1.375rem', { lineHeight: '1.875rem' }],
        '2xl': ['1.75rem', { lineHeight: '2.25rem' }],
        '3xl': ['2.25rem', { lineHeight: '2.625rem' }],
      },
      borderRadius: { sm: '6px', DEFAULT: '8px', md: '10px', lg: '14px' },
      boxShadow: {
        raised: '0 1px 2px rgb(0 0 0 / 0.18), 0 8px 24px -12px rgb(0 0 0 / 0.35)',
        overlay: '0 24px 64px -16px rgb(0 0 0 / 0.55)',
      },
      transitionDuration: { fast: '120ms', base: '200ms', slow: '300ms' },
      zIndex: { sidebar: '30', topbar: '40', overlay: '50', toast: '60' },
    },
  },
  plugins: [animate],
};
