/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dojo: {
          primary: '#6D28D9',
          primaryDark: '#5B21B6',
          accent: '#F59E0B',
          success: '#10B981',
          danger: '#EF4444',
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          ink: '#0F172A',
          muted: '#64748B',
        },
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        dojo: '0 10px 30px -12px rgba(109, 40, 217, 0.35)',
      },
    },
  },
  plugins: [],
};
