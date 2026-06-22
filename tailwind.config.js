/** @type {import('tailwindcss').Config} */

// ── Dock Design System — paleta convergida ────────────────────────────────────
// Regra: apenas 3 tons visuais por cor. Shades extras apontam para o tom mais próximo.
// Isso garante consistência visual mesmo com classes legadas (blue-500, blue-800, etc.)

const T = '#f8fafc'   // tertiary bg
const S = '#e7f2ff'   // secondary surface
const P = '#0b4f9e'   // primary action
const H = '#0a417f'   // hover de primary

const primary = {
  50: T, 100: S, 200: S, 300: S,
  400: P, 500: P, 600: P,
  700: H, 800: P, 900: P,
}

const dsGray = {
  50:  '#f7f8fa',  // page bg
  100: '#eef0f4',  // surface / card
  200: '#d6dae4',  // borders
  300: '#d6dae4',  // alias → borders
  400: '#9198a8',  // muted text
  500: '#737b8f',  // secondary text
  600: '#737b8f',  // alias → secondary text
  700: '#434b60',  // primary text
  800: '#434b60',  // alias → primary text
  900: '#0f1420',  // headings
}

const success = {
  50: '#f0fdf8', 100: '#f0fdf8', 200: '#f0fdf8', 300: '#f0fdf8',
  400: '#00c27a', 500: '#00c27a', 600: '#00c27a',
  700: '#007549', 800: '#007549', 900: '#007549',
}

const danger = {
  50: '#fff0f3', 100: '#fff0f3', 200: '#fff0f3', 300: '#fff0f3',
  400: '#e8335a', 500: '#e8335a', 600: '#e8335a',
  700: '#9e1037', 800: '#9e1037', 900: '#9e1037',
}

const warning = {
  50: '#fffbeb', 100: '#fffbeb', 200: '#fffbeb', 300: '#fffbeb',
  400: '#f59e0b', 500: '#f59e0b', 600: '#f59e0b',
  700: '#b45309', 800: '#b45309', 900: '#b45309',
}

export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',

      // Escalas semânticas DS Dock
      primary,
      success,
      danger,
      warning,
      gray: dsGray,

      // Aliases Tailwind → DS (mantém classes existentes funcionando)
      blue:    primary,
      indigo:  primary,
      green:   success,
      emerald: success,
      red:     danger,
      rose:    danger,
      amber:   warning,
      yellow:  warning,
      slate:   dsGray,
      zinc:    dsGray,
      neutral: dsGray,
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
