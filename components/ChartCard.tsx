import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { EnergyData } from '../types/energyData';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface ChartCardProps {
  title: string;
  data: EnergyData[];
  dataKey: keyof EnergyData;
}

import { useTheme } from 'next-themes';
import { useRef, useEffect } from 'react';
// ... otras importaciones

export default function ChartCard({ title, data, dataKey }: ChartCardProps) {
  const { theme } = useTheme();
  const chartRef = useRef<any>(null);

  const options: ApexOptions = {
    chart: {
      zoom: { enabled: true, type: 'xy', autoScaleYaxis: true },
      toolbar: { show: true, tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
      events: { beforeResetZoom: () => false },
    },
    xaxis: {
      type: 'datetime',
      labels: { format: 'HH:mm', style: { colors: theme === 'dark' ? '#fff' : '#000' } },
    },
    yaxis: {
      title: { text: title, style: { color: theme === 'dark' ? '#fff' : '#000' } },
    },
    stroke: { curve: 'smooth' },
    theme: { mode: theme === 'dark' ? 'dark' : 'light' }, // Tema dinámico
  };

  const series = [
    {
      name: title,
      data: data.map((item) => ({
        x: new Date(item.timestamp).getTime(),
        y: item[dataKey],
      })),
    },
  ];

  useEffect(() => {
    if (chartRef.current && chartRef.current.chart) {
      chartRef.current.chart.updateSeries(series, false);
    }
  }, [data]);

  return (
    <div className="chart p-4 bg-white dark:bg-gray-900">
      <Chart options={options} series={series} type="line" height={350} ref={chartRef} />
    </div>
  );
}