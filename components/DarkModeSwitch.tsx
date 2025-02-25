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
      <label className="relative inline-block h-8 w-14 cursor-pointer rounded-full bg-gray-300 transition [-webkit-tap-highlight-color:_transparent] has-[:checked]:bg-green-500" htmlFor="dark_mode">
        <input type="checkbox" id="dark_mode" className="peer sr-only" 
          checked={isDark}
          onChange={() => setIsDark(!isDark)}
        />
        <span className="absolute inset-y-0 start-0 m-1 size-6 rounded-full bg-white transition-all peer-checked:start-6"
        ></span>
      </label>
    </div>
  );
}