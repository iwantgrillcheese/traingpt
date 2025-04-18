// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',       // if you're using the /app directory
    './pages/**/*.{js,ts,jsx,tsx}',     // if you're using the /pages directory
    './components/**/*.{js,ts,jsx,tsx}',// any shared components
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
