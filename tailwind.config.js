/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        magenta: {
          50:  '#FEE5F1',
          100: '#FCC2DF',
          200: '#F88BC1',
          300: '#F254A2',
          400: '#EB2287',
          500: '#E20074',
          600: '#B80060',
          700: '#8E004A',
          800: '#660035',
          900: '#3D0020',
        },
        ink: {
          900: '#000000',
          800: '#191919',
          700: '#2D2D2D',
          600: '#525252',
          500: '#6A6A6A',
          400: '#A3A3A3',
          300: '#D5D5D5',
          200: '#E8E8E8',
          100: '#F3F3F3',
          50:  '#F6F6F6',
        },
      },
      fontFamily: {
        sans: ['InterVariable', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
