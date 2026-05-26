/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#0F172A',
        'surface-2': '#1E293B',
        border: '#334155',
        foreground: '#F8FAFC',
        muted: '#94A3B8',
        brand: {
          green: '#22C55E',
          red: '#EF4444',
          amber: '#F59E0B',
          blue: '#3B82F6',
          orange: '#F97316',
        },
      },
    },
  },
  plugins: [],
};
