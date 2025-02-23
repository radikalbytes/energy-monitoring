import { useState, useEffect } from 'react';

export default function DarkModeSwitch() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    console.log('Modo oscuro:', isDark); // Depuración
    if (isDark) {
      document.documentElement.classList.add('dark');
      console.log('Clases de <html>:', document.documentElement.className); // Verifica clases
    } else {
      document.documentElement.classList.remove('dark');
      console.log('Clases de <html>:', document.documentElement.className); // Verifica clases
    }
  }, [isDark]);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm dark:text-white">{isDark ? 'Oscuro' : 'Claro'}</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={isDark}
          onChange={() => setIsDark(!isDark)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );
}