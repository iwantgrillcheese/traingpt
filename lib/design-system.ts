// lib/design-system.ts

export const ds = {
    spacing: {
      container: 'max-w-5xl mx-auto px-4 py-12',
    },
    font: {
      header: 'text-4xl font-bold tracking-tight',
      subheader: 'text-lg text-gray-500',
    },
    button: {
      primary: 'px-6 py-3 bg-orange-600 text-white font-semibold rounded-full hover:bg-orange-700 transition disabled:opacity-50',
      secondary: 'px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition',
    },
    card: {
      base: 'bg-orange-50 border border-gray-200 p-4 rounded-xl shadow-sm',
    },
    layout: {
      wrapper: 'flex min-h-screen bg-gray-50 text-gray-800 font-sans',
      page: 'flex-1 transition-all duration-300',
    },
  };
  