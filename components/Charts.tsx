import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme } from 'next-themes';
import { Bucket } from '../lib/energy';
import { EnergyData } from '../types/energyData';
import { BAND_COLORS, BAND_LABELS, HourBand, PvpcPoint } from '../lib/tariffs';

const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />,
});

export const COLORS = {
  power: '#6366f1',
  energy: '#10b981',
  warn: '#f59e0b',
  temp: '#f97316',
  hum: '#0ea5e9',
};

function useBase(): ApexOptions {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return {
    chart: {
      background: 'transparent',
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'inherit',
      foreColor: dark ? '#94a3b8' : '#64748b',
      animations: { enabled: true, speed: 450 },
    },
    theme: { mode: dark ? 'dark' : 'light' },
    grid: { borderColor: dark ? 'rgba(148,163,184,.12)' : 'rgba(100,116,139,.15)', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: dark ? 'dark' : 'light', x: { show: true } },
  };
}

const merge = (a: ApexOptions, b: ApexOptions): ApexOptions => ({
  ...a,
  ...b,
  chart: { ...a.chart, ...b.chart },
  grid: { ...a.grid, ...b.grid },
  tooltip: { ...a.tooltip, ...b.tooltip },
});

export function PowerGauge({ value, max }: { value: number; max: number }) {
  const base = useBase();
  const pct = Math.max(2, Math.min(100, (value / Math.max(max, 1)) * 100));
  const options: ApexOptions = merge(base, {
    chart: { type: 'radialBar', sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -125,
        endAngle: 125,
        hollow: { size: '66%' },
        track: { background: 'rgba(255,255,255,.18)', strokeWidth: '100%' },
        dataLabels: { show: false },
      },
    },
    fill: {
      type: 'gradient',
      gradient: { shade: 'dark', type: 'horizontal', gradientToColors: ['#fde047'], stops: [0, 100] },
    },
    colors: ['#ffffff'],
    stroke: { lineCap: 'round' },
  });
  return <Chart options={options} series={[pct]} type="radialBar" height="100%" />;
}

export function PowerArea({ data, from }: { data: EnergyData[]; from: number }) {
  const base = useBase();
  const points = downsample(data, 400).map((d) => [d.timestamp, Math.round(d.power)]);
  const span = Date.now() - from;
  const options: ApexOptions = merge(base, {
    chart: { type: 'area', zoom: { enabled: false } },
    stroke: { curve: 'smooth', width: 2.5 },
    colors: [COLORS.power],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.02, stops: [0, 95] } },
    xaxis: {
      type: 'datetime',
      min: from,
      labels: { datetimeUTC: false, format: span <= 36 * 3600_000 ? 'HH:mm' : 'dd MMM' },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { formatter: (v) => `${Math.round(v)} W` }, min: 0 },
    tooltip: { x: { format: 'dd MMM HH:mm' }, y: { formatter: (v) => `${v} W` } },
  });
  return <Chart options={options} series={[{ name: 'Potencia', data: points }]} type="area" height="100%" />;
}

export function ConsumptionBars({ buckets, daily, price }: { buckets: Bucket[]; daily: boolean; price: number }) {
  const base = useBase();
  const options: ApexOptions = merge(base, {
    chart: { type: 'bar' },
    colors: [COLORS.energy],
    plotOptions: { bar: { borderRadius: 6, columnWidth: daily ? '62%' : '70%', borderRadiusApplication: 'end' } },
    xaxis: {
      type: 'datetime',
      labels: { datetimeUTC: false, format: daily ? 'dd MMM' : 'HH:mm' },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { formatter: (v) => `${v.toFixed(daily ? 1 : 2)}` }, title: { text: 'kWh' } },
    tooltip: {
      x: { format: daily ? 'dd MMM yyyy' : 'dd MMM HH:mm' },
      y: { formatter: (v) => `${v.toFixed(2)} kWh · ${(v * price).toFixed(2)} €` },
    },
  });
  const series = [{ name: 'Consumo', data: buckets.map((b) => [b.start, Number(b.kwh.toFixed(3))]) }];
  return <Chart options={options} series={series} type="bar" height="100%" />;
}

export function HourlyBars({ hourly, peakHour }: { hourly: number[]; peakHour: number | null }) {
  const base = useBase();
  const options: ApexOptions = merge(base, {
    chart: { type: 'bar' },
    colors: hourly.map((_, h) => (h === peakHour ? COLORS.warn : COLORS.power)),
    plotOptions: { bar: { borderRadius: 4, columnWidth: '68%', distributed: true, borderRadiusApplication: 'end' } },
    legend: { show: false },
    xaxis: {
      categories: hourly.map((_, h) => String(h).padStart(2, '0')),
      labels: { rotate: 0, hideOverlappingLabels: true, style: { fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { formatter: (v) => `${Math.round(v)}` }, title: { text: 'W medios' } },
    tooltip: {
      x: { formatter: (_v, o) => `${String(o?.dataPointIndex ?? 0).padStart(2, '0')}:00 h` },
      y: { formatter: (v) => `${Math.round(v)} W` },
    },
  });
  return (
    <Chart
      options={options}
      series={[{ name: 'Potencia media', data: hourly.map((v) => Math.round(v)) }]}
      type="bar"
      height="100%"
    />
  );
}

export function ClimateChart({ data, from }: { data: EnergyData[]; from: number }) {
  const base = useBase();
  const pts = downsample(data, 200);
  const options: ApexOptions = merge(base, {
    chart: { type: 'line' },
    stroke: { curve: 'smooth', width: [2.5, 2.5] },
    colors: [COLORS.temp, COLORS.hum],
    legend: { position: 'top', horizontalAlign: 'right', markers: { size: 6 } },
    xaxis: {
      type: 'datetime',
      min: from,
      labels: { datetimeUTC: false, format: 'HH:mm' },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      { seriesName: 'Temperatura', labels: { formatter: (v) => `${v.toFixed(0)}°` } },
      { seriesName: 'Humedad', opposite: true, labels: { formatter: (v) => `${v.toFixed(0)}%` } },
    ],
    tooltip: { x: { format: 'dd MMM HH:mm' } },
  });
  const series = [
    { name: 'Temperatura', data: pts.map((d) => [d.timestamp, d.temperature]) },
    { name: 'Humedad', data: pts.map((d) => [d.timestamp, d.humidity > 0 && d.humidity <= 95 ? d.humidity : null]) },
  ];
  return <Chart options={options} series={series} type="line" height="100%" />;
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)]);
  out.push(arr[arr.length - 1]);
  return out;
}

export function PvpcChart({ points, bands, nowTs, discount }: { points: PvpcPoint[]; bands: HourBand[]; nowTs: number; discount: number }) {
  const base = useBase();
  const factor = 1 - discount;
  const options: ApexOptions = merge(base, {
    chart: { type: 'bar' },
    plotOptions: { bar: { columnWidth: '78%', borderRadius: 4, distributed: true } },
    colors: bands.map((b) => BAND_COLORS[b]),
    legend: { show: false },
    xaxis: {
      type: 'category',
      categories: points.map((p) => `${new Date(p.ts).getHours().toString().padStart(2, '0')}h`),
      labels: { rotate: 0, hideOverlappingLabels: true },
      axisTicks: { show: false },
    },
    yaxis: { labels: { formatter: (v: number) => `${(v * 100).toFixed(0)} c€` } },
    tooltip: {
      y: { formatter: (v: number) => `${v.toFixed(4)} €/kWh` },
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const p = points[dataPointIndex];
        const band = bands[dataPointIndex];
        const h = new Date(p.ts).getHours();
        return `<div style="padding:8px 12px;font-size:12px"><b>${h}:00 – ${(h + 1) % 24}:00</b><br/>${(p.price * factor).toFixed(4)} €/kWh<br/><span style="color:${BAND_COLORS[band]}">● ${BAND_LABELS[band]}</span></div>`;
      },
    },
    annotations: {
      xaxis: points
        .filter((p) => nowTs >= p.ts && nowTs < p.ts + 3600_000)
        .map((p) => ({
          x: `${new Date(p.ts).getHours().toString().padStart(2, '0')}h`,
          borderColor: '#6366f1',
          label: { text: 'Ahora', style: { color: '#fff', background: '#6366f1' }, orientation: 'horizontal' },
        })),
    },
  });
  return <Chart options={options} series={[{ name: '€/kWh', data: points.map((p) => +(p.price * factor).toFixed(5)) }]} type="bar" height="100%" />;
}
