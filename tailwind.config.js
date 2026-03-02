/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        anime: {
          pink: '#ff4d85',
          purple: '#7b61ff',
          bg: '#fdf2f8',
          card: '#ffffff',
          inactive: '#cbd5e0',
          border: '#f3e8ff'
        }
      },
      borderRadius: {
        'kawaii': '24px',
        'soft': '16px'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
}
