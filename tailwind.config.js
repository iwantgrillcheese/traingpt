// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#111827',
          light: '#6B7280',
          muted: '#9CA3AF',
        },
        background: {
          light: '#F9FAFB',
          lighter: '#FCFCFD',
        },
        accent: {
          swim: '#60A5FA',
          swimBg: '#E0F2FE',   // pastel
          bike: '#34D399',
          bikeBg: '#D1FAE5',
          run: '#FBBF24',
          runBg: '#FEF9C3',
          rest: '#D1D5DB',
        },
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(0,0,0,0.06)',
        medium: '0 4px 8px rgba(0,0,0,0.1)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
