/** @type {import('tailwindcss').Config} */

// ── Dock Design System — paleta de cores ──────────────────────────────────────
const primary = {
  50: '#f8fafc', 100: '#e7f2ff', 200: '#d2e6ff', 300: '#b3d9ff',
  400: '#6dbbfe', 500: '#1e96fc', 600: '#0b4f9e', 700: '#0a417f',
  800: '#082c66', 900: '#071a52',
}
const secondary = {
  50: '#f0fefe', 100: '#e0fafa', 200: '#b3f1f1', 300: '#70e8e8',
  400: '#1adddd', 500: '#00d8d8', 600: '#00aeae', 700: '#008888',
  800: '#006464', 900: '#004444',
}
const navy = {
  50: '#eef2f8', 100: '#d8e1ef', 200: '#b3c2dc', 300: '#7f9abf',
  400: '#4d74a2', 500: '#2b5080', 600: '#243854', 700: '#1a2e4a',
  800: '#0f1e33', 900: '#0a1628',
}
const dsGray = {
  50: '#f7f8fa', 100: '#eef0f4', 200: '#d6dae4', 300: '#b8bec9',
  400: '#9198a8', 500: '#737b8f', 600: '#5a6278', 700: '#434b60',
  800: '#2c3345', 900: '#0f1420',
}
const success = {
  50: '#f0fdf8', 100: '#ccfaed', 200: '#99f5d9', 300: '#5cebbf',
  400: '#16e193', 500: '#00c27a', 600: '#009b61', 700: '#007549',
  800: '#005533', 900: '#003320',
}
const danger = {
  50: '#fff0f3', 100: '#ffd0da', 200: '#ffa0b5', 300: '#ff7290',
  400: '#f55078', 500: '#e8335a', 600: '#c42047', 700: '#9e1037',
  800: '#7a0a28', 900: '#5a0018',
}
const warning = {
  50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
  400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
  800: '#92400e', 900: '#78350f',
}
// Purple mantido (Tailwind default) para estados de contraproposta / pending
const purple = {
  50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe',
  400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce',
  800: '#6b21a8', 900: '#581c87',
}

export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    // Substituir escalas padrão do Tailwind pelos tokens do DS Dock
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',

      // Escalas semânticas DS Dock
      primary,   // nome canônico
      secondary, // ciano Dock
      navy,      // fundo escuro / backoffice
      success,   // aprovação
      danger,    // erro / destrutivo
      warning,   // atenção
      gray: dsGray,
      purple,    // contraproposta / pending states

      // Aliases Tailwind → DS (mantém classes existentes funcionando)
      blue:    primary,
      indigo:  primary,
      teal:    secondary,
      cyan:    secondary,
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

