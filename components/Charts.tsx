import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { useTheme } from 'next-themes';
import { Bucket, isValidHumidity } from '../lib/energy';
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

// Convierte los precios horarios en una serie escalonada con forma de barras (con un pequeño hueco entre horas).
// Se dibuja como área "stepline" para no alterar el eje X de la gráfica de potencia (las barras de ApexCharts
// en un eje de fechas ajustan su anchura al menor intervalo entre puntos y se pintarían encima del área).
function pvpcBars(pvpc: PvpcPoint[], from: number, to: number, factor: number): number[][] {
  const H = 3600_000;
  const gap = H * 0.04;
  const out: number[][] = [];
  pvpc
    .filter((p) => p.ts + H > from && p.ts <= to)
    .sort((a, b) => a.ts - b.ts)
    .forEach((p) => {
      const price = +(p.price * factor).toFixed(5);
      out.push([Math.max(p.ts + gap, from), price], [p.ts + H - gap, 0]);
    });
  return out;
}

export interface OutageBand {
  start: number;
  end: number | null; // null = sigue sin luz
}

const OUTAGE_COLOR = '#ef4444';

// Franjas rojas en el eje X para los cortes de luz dentro del periodo [from, to].
function outageAnnotations(outages: OutageBand[], from: number, to: number): ApexOptions['annotations'] {
  return {
    xaxis: outages
      .filter((o) => o.start < to && (o.end ?? to) > from)
      .map((o) => ({
        x: Math.max(o.start, from),
        x2: Math.min(o.end ?? to, to),
        fillColor: OUTAGE_COLOR,
        opacity: 0.18,
        borderColor: OUTAGE_COLOR,
        strokeDashArray: 0,
        label: {
          text: o.end == null ? 'Sin luz' : 'Corte',
          orientation: 'horizontal',
          borderColor: OUTAGE_COLOR,
          style: { color: '#fff', background: OUTAGE_COLOR, fontSize: '10px' },
        },
      })),
  };
}

// Formato del eje X según la duración del periodo.
const axisFormat = (span: number) => (span <= 36 * 3600_000 ? 'HH:mm' : span <= 4 * 86400_000 ? 'dd MMM HH:mm' : 'dd MMM');

export function PowerArea({ data, from, to, pvpc = [], discount = 0, outages = [] }: {
  data: EnergyData[]; from: number; to?: number; pvpc?: PvpcPoint[]; discount?: number; outages?: OutageBand[];
}) {
  const base = useBase();
  const points = downsample(data, 400).map((d) => [d.timestamp, Math.round(d.power)]);
  const end = to ?? Date.now();
  const span = end - from;
  const annotations = outageAnnotations(outages, from, end);
  const bars = pvpcBars(pvpc, from, end, 1 - discount);
  if (bars.length) return <PowerWithPvpc base={base} points={points} bars={bars} from={from} to={to} span={span} annotations={annotations} />;
  const options: ApexOptions = merge(base, {
    chart: { type: 'area', zoom: { enabled: false } },
    stroke: { curve: 'smooth', width: 2.5 },
    colors: [COLORS.power],
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.02, stops: [0, 95] } },
    xaxis: {
      type: 'datetime',
      min: from,
      max: to,
      labels: { datetimeUTC: false, format: axisFormat(span) },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { formatter: (v) => `${Math.round(v)} W` }, min: 0 },
    annotations,
    tooltip: { x: { format: 'dd MMM HH:mm' }, y: { formatter: (v) => `${v} W` } },
  });
  return <Chart options={options} series={[{ name: 'Potencia', data: points }]} type="area" height="100%" />;
}

const PVPC_COLOR = '#f59e0b';

// Potencia con el precio PVPC por horas detrás (50 % de transparencia). Son dos gráficas superpuestas con
// exactamente las mismas series y ejes para que coincidan píxel a píxel: la de atrás solo pinta las barras
// de precio y la de delante solo la potencia (más los ejes y el tooltip).
function PowerWithPvpc({ base, points, bars, from, to, span, annotations }: {
  base: ApexOptions; points: number[][]; bars: number[][]; from: number; to?: number; span: number; annotations: ApexOptions['annotations'];
}) {
  const series = [
    { name: 'Potencia', type: 'area', data: points },
    { name: 'PVPC', type: 'area', data: bars },
  ];
  const common = (back: boolean): ApexOptions =>
    merge(base, {
      chart: { type: 'area', zoom: { enabled: false }, ...(back ? { foreColor: 'transparent' } : {}) },
      ...(back ? { grid: { borderColor: 'transparent' } } : {}),
      stroke: { curve: ['smooth', 'stepline'], width: back ? [0, 0] : [2.5, 0] },
      colors: [COLORS.power, PVPC_COLOR],
      fill: back
        ? { type: 'solid', opacity: [0, 0.5] }
        : {
            type: ['gradient', 'solid'],
            opacity: [1, 0],
            gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.02, stops: [0, 95] },
          },
      legend: { show: false },
      markers: { size: 0 },
      // Las franjas de corte van en la capa de atrás para quedar detrás de la potencia.
      ...(back ? { annotations } : {}),
      xaxis: {
        type: 'datetime',
        min: from,
        max: to,
        labels: { datetimeUTC: false, format: axisFormat(span) },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: [
        { seriesName: 'Potencia', min: 0, labels: { formatter: (v: number) => `${Math.round(v)} W` } },
        { seriesName: 'PVPC', opposite: true, min: 0, labels: { formatter: (v: number) => `${(v * 100).toFixed(0)} c€` } },
      ],
      tooltip: back
        ? { enabled: false }
        : { enabledOnSeries: [0], x: { format: 'dd MMM HH:mm' }, y: { formatter: (v: number) => `${v} W` } },
      states: back ? undefined : { hover: { filter: { type: 'none' } }, active: { filter: { type: 'none' } } },
    });
  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute inset-0">
        <Chart options={common(true)} series={series} type="area" height="100%" />
      </div>
      <div className="absolute inset-0">
        <Chart options={common(false)} series={series} type="area" height="100%" />
      </div>
    </div>
  );
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

export function ClimateChart({ data, from, to }: { data: EnergyData[]; from: number; to?: number }) {
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
      max: to,
      labels: { datetimeUTC: false, format: to != null && to - from > 36 * 3600_000 ? axisFormat(to - from) : 'HH:mm' },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: [
      { seriesName: 'Temperatura', labels: { formatter: (v) => `${v.toFixed(0)}°` } },
      { seriesName: 'Humedad', opposite: true, min: 0, max: 100, tickAmount: 5, forceNiceScale: false, labels: { formatter: (v) => `${v.toFixed(0)}%` } },
    ],
    tooltip: { x: { format: 'dd MMM HH:mm' } },
  });
  const series = [
    { name: 'Temperatura', data: pts.map((d) => ({ x: d.timestamp, y: d.temperature })) },
    { name: 'Humedad', data: pts.map((d) => ({ x: d.timestamp, y: isValidHumidity(d) ? d.humidity : null })) },
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
