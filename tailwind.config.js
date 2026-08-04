/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./index.{js,jsx,ts,tsx}",
    "./W3LabsAgro.{js,jsx,ts,tsx}",
    "./Screens/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        lime: {
          50: '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
          800: '#3f6212',
          900: '#365314',
          950: '#1a2e05',
        },
        agro: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        }
      },
      fontFamily: {
        sans: ['"Nokia Pure Headline"', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        nokia: ['"Nokia Pure Headline"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'agro': '0 10px 25px -5px rgba(22, 163, 74, 0.15), 0 8px 10px -6px rgba(22, 163, 74, 0.1)',
        'agro-lg': '0 20px 30px -10px rgba(22, 163, 74, 0.25)',
        'lime': '0 10px 25px -5px rgba(132, 204, 22, 0.35), 0 8px 10px -6px rgba(132, 204, 22, 0.2)',
        'lime-lg': '0 20px 30px -10px rgba(132, 204, 22, 0.45)',
        'lime-glow': '0 0 25px rgba(163, 230, 53, 0.45)',
      }
    },
  },
  plugins: [],
};

