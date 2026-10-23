/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0A',
        panel: '#111111',
        card: '#171717',
        line: '#292929',
        muted: '#A3A3A3',
        signal: '#D6A654',
      },
    },
  },
  plugins: [],
}
