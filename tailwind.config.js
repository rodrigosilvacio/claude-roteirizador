/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#26495c', deep: '#1b3644', soft: '#5d7685' },
        sun: { DEFAULT: '#e8a63c', soft: '#f4e9d6', line: '#efcf8f' },
        paper: { DEFAULT: '#f4f2ee', card: '#faf8f4', line: '#d9d4cb' },
        alert: '#c0533f',
      },
      fontFamily: {
        sans: ['"Schibsted Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
