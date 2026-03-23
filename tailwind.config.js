/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5AA0E8',
        'primary-light': '#e8f2fd',
        'primary-text': '#3a7bc8',
      },
      fontSize: {
        xs: '11px',
        sm: '12px',
      },
      letterSpacing: {
        widest: '0.12em',
        wider: '0.08em',
      },
    },
  },
  plugins: [],
}
