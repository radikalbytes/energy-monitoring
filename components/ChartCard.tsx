import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { EnergyData } from '../types/energyData';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface ChartCardProps {
  title: string;
  data: EnergyData[];
  dataKey: keyof EnergyData;
}

export default function ChartCard({ title, data, dataKey }: ChartCardProps) {
  const options: ApexOptions = {
    chart: { zoom: { enabled: true }, toolbar: { show: true } },
    xaxis: { type: 'datetime', labels: { format: 'HH:mm', style: { colors: '#000', cssClass: 'dark:text-white' } } },
    yaxis: { title: { text: title, style: { color: '#000', cssClass: 'dark:text-white' } } },
    stroke: { curve: 'smooth' },
    theme: { mode: 'light' }, // Cambia dinámicamente en modo oscuro
  };

  const series = [{
    name: title,
    data: data.map(d => ({ x: d.timestamp, y: d[dataKey] })),
  }];

  return (
    <div className="bg-white p-4 rounded-lg shadow dark:bg-gray-800">
      <h2 className="text-lg font-semibold mb-2 dark:text-white">{title}</h2>
      <Chart options={options} series={series} type="line" height={300} />
    </div>
  );
}