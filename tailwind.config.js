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
          DEFAULT: '#111827',    // text-gray-900
          light: '#6B7280',      // text-gray-500
          muted: '#9CA3AF',      // text-gray-400
        },
        background: {
          light: '#F9FAFB',      // gray-50
          lighter: '#FCFCFD',    // lighter off-white
        },
        accent: {
          swim: '#60A5FA',       // sky-400
          bike: '#34D399',       // emerald-400
          run: '#FBBF24',        // amber-400
          rest: '#D1D5DB',       // gray-300
        },
      },
      boxShadow: {
        subtle: '0 1px 3px rgba(0,0,0,0.06)',    // subtle shadows for cards
        medium: '0 4px 8px rgba(0,0,0,0.1)',     // modals, buttons
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
