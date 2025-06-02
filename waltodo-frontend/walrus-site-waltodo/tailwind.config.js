/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    fontFamily: {
      sans: [
        'ui-sans-serif',
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ],
    },
    extend: {
      colors: {
        // Oceanic dreamy palette
        'ocean-deep': '#003366',
        'ocean-medium': '#0077b6',
        'ocean-light': '#90e0ef',
        'ocean-foam': '#caf0f8',
        'dream-purple': '#7209b7',
        'dream-violet': '#9d4edd',
        'dream-teal': '#48bfe3',
        coral: '#ff7f50',
        sand: '#f5e1c0',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'ocean-wave': 'url("/images/ocean-wave.svg")',
      },
      animation: {
        wave: 'wave 8s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(2deg)' },
        },
      },
      boxShadow: {
        dreamy: '0 4px 30px rgba(0, 105, 148, 0.3)',
        underwater: '0 8px 32px rgba(144, 224, 239, 0.3)',
      },
    },
  },
  plugins: [],
};