import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';

export default function Dashboard() {
  const { theme, setTheme } = useTheme();
  const [isDark, setIsDark] = useState(theme === 'dark');


  return (
    <>
      <div className="flex items-center gap-2">
        
      </div>
      <div>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          style={{ padding: '10px', margin: '10px' }}
        >
          Cambiar a {theme === 'dark' ? 'modo claro' : 'modo oscuro'}
        </button>
        {/* Tus gráficas y el botón de borrar aquí */}
      </div>
    </>
  );
}