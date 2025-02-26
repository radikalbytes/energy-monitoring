import { useState, useEffect } from 'react';
import ChartCard from '../components/ChartCard';
import DeviceSelector from '../components/DeviceSelector';
import TimeRangeSelector from '../components/TimeRangeSelector';
import DarkModeSwitch from '../components/DarkModeSwitch'; // Importa el nuevo componente
import { EnergyData } from '../types/energyData';
import { useTheme } from 'next-themes';

export default function Home() {
  const [data, setData] = useState<EnergyData[]>([]);
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<number>(3600000);
  const [loading, setLoading] = useState(false);
  const { theme, setTheme } = useTheme();

  const handleDeleteData = async () => {
    if (!confirm('¿Estás seguro de que quieres borrar todos los datos?')) return;

    setLoading(true);
    try {
      const response = await fetch('/api/data', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al borrar los datos');
      }

      const result = await response.json();
      console.log(result.message);
      // Opcional: recargar datos para actualizar las gráficas
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('No se pudo borrar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const url = selectedDevice
        ? `/api/data?uuid=${selectedDevice}&timeRange=${timeRange}`
        : `/api/data?timeRange=${timeRange}`;
      const response = await fetch(url);
      const result = await response.json();
      setData(result.energyData);
      setDevices(result.devices);
    };

    fetchData();
    const interval = setInterval(fetchData, 180000); //Actualización cada 3 minutos
  }, [selectedDevice, timeRange]);

  return (
    <div className="container mx-auto p-4 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold dark:text-white">Monitor de Energía</h1>
        <DarkModeSwitch />
      </div>
      <div className="flex gap-4 mb-4">
        <DeviceSelector devices={devices} selectedDevice={selectedDevice} onSelect={setSelectedDevice} />
        <TimeRangeSelector onSelect={setTimeRange} />
      </div>
      <div>
        {/* Tus gráficas aquí */}
        <button
          onClick={handleDeleteData}
          disabled={loading}
          style={{ padding: '10px', margin: '10px', backgroundColor: '#ff4444', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          {loading ? 'Borrando...' : 'Borrar todos los datos'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Corriente RMS (A)" data={data} dataKey="irms" />
        <ChartCard title="Potencia (W)" data={data} dataKey="power" />
        <ChartCard title="Temperatura (°C)" data={data} dataKey="temperature" />
        <ChartCard title="Humedad (%)" data={data} dataKey="humidity" />
      </div>
    </div>
  );
}