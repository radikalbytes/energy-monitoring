import { EnergyData } from '../types/energyData';
import {
  DEFAULT_DISCOUNT_RATES, DEFAULT_HOUSEHOLD_LIMITS, DiscountKey, HouseholdKey,
} from './tariffs';

export type PeriodKey = '24h' | '7d' | '30d';

export const PERIODS: { key: PeriodKey; label: string; ms: number }[] = [
  { key: '24h', label: '24 horas', ms: 24 * 3600_000 },
  { key: '7d', label: '7 días', ms: 7 * 24 * 3600_000 },
  { key: '30d', label: '30 días', ms: 30 * 24 * 3600_000 },
];

export interface Settings {
  price: number; // €/kWh
  co2Factor: number; // kg CO2 por kWh
  monthlyBudget: number; // € al mes
  comercializadora: string;
  discount: DiscountKey;
  discountRates: Record<Exclude<DiscountKey, 'none'>, number>; // %
  household: HouseholdKey;
  householdLimits: Record<HouseholdKey, number>; // kWh/año con descuento
  periodStart: string; // inicio del periodo anual del descuento (YYYY-MM-DD)
  alerts: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  price: 0.15,
  co2Factor: 0.15,
  monthlyBudget: 60,
  comercializadora: 'pvpc',
  discount: 'none',
  discountRates: DEFAULT_DISCOUNT_RATES,
  household: 'h1',
  householdLimits: DEFAULT_HOUSEHOLD_LIMITS,
  periodStart: `${new Date().getFullYear()}-01-01`,
  alerts: true,
};

const NOMINAL_STEP = 5 * 60_000;
const MAX_GAP = 15 * 60_000;

export const isValidClimate = (d: EnergyData) => !(d.temperature === 0 && d.humidity === 0);
// Humedad 0 = sin dato (el firmware la descarta); >95 % sostenido indica sensor saturado.
export const HUMIDITY_MAX_VALID = 95;
export const isValidHumidity = (d: EnergyData) => isValidClimate(d) && d.humidity > 0 && d.humidity <= HUMIDITY_MAX_VALID;
export function humiditySensorSuspect(data: EnergyData[], now = Date.now()): boolean {
  const recent = data.filter((d) => now - d.timestamp < 3 * 3600_000 && isValidClimate(d));
  if (recent.length < 5) return false;
  const bad = recent.filter((d) => d.humidity === 0 || d.humidity > HUMIDITY_MAX_VALID).length;
  return bad / recent.length >= 0.8;
}

// Integra la potencia (W) en el tiempo; los huecos largos (sin datos) no suman consumo.
export function kwhBetween(data: EnergyData[], from: number, to: number): number {
  let wh = 0;
  for (let i = 0; i < data.length; i++) {
    const t = data[i].timestamp;
    if (t < from || t >= to) continue;
    const next = i + 1 < data.length ? data[i + 1].timestamp : t + NOMINAL_STEP;
    const dt = Math.min(next - t, MAX_GAP);
    wh += (data[i].power * dt) / 3600_000;
  }
  return wh / 1000;
}

export interface Bucket {
  start: number;
  kwh: number;
  avgPower: number;
  samples: number;
}

export function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function bucketize(data: EnergyData[], from: number, to: number, stepMs: number, alignLocal = false): Bucket[] {
  const start0 = alignLocal ? startOfLocalDay(from) : Math.floor(from / stepMs) * stepMs;
  const buckets: Bucket[] = [];
  for (let s = start0; s < to; s += stepMs) {
    buckets.push({ start: s, kwh: 0, avgPower: 0, samples: 0 });
  }
  const sums = buckets.map(() => 0);
  for (let i = 0; i < data.length; i++) {
    const t = data[i].timestamp;
    if (t < start0 || t >= to) continue;
    const idx = Math.floor((t - start0) / stepMs);
    const b = buckets[idx];
    if (!b) continue;
    const next = i + 1 < data.length ? data[i + 1].timestamp : t + NOMINAL_STEP;
    const dt = Math.min(next - t, MAX_GAP);
    b.kwh += (data[i].power * dt) / 3600_000 / 1000;
    sums[idx] += data[i].power;
    b.samples++;
  }
  buckets.forEach((b, i) => {
    b.avgPower = b.samples ? sums[i] / b.samples : 0;
  });
  return buckets;
}

export function hourlyProfile(data: EnergyData[]): number[] {
  const sum = new Array(24).fill(0);
  const cnt = new Array(24).fill(0);
  for (const d of data) {
    const h = new Date(d.timestamp).getHours();
    sum[h] += d.power;
    cnt[h]++;
  }
  return sum.map((s, h) => (cnt[h] ? s / cnt[h] : 0));
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export interface Summary {
  kwh: number;
  prevKwh: number;
  cost: number;
  prevCost: number;
  co2: number;
  avgPower: number;
  peakPower: number;
  peakTime: number | null;
  standbyW: number;
  standbyYearCost: number;
  dailyKwh: number;
  monthProjectionCost: number;
  monthProjectionKwh: number;
  todayKwh: number;
  todayCost: number;
  yesterdayKwh: number;
  hourly: number[];
  peakHour: number | null;
  current: EnergyData | null;
  online: boolean;
  deltaKwhPct: number | null;
  avgTemp: number | null;
  avgHum: number | null;
}

export function summarize(all: EnergyData[], periodMs: number, settings: Settings, now = Date.now()): Summary {
  const from = now - periodMs;
  const prevFrom = from - periodMs;
  const cur = all.filter((d) => d.timestamp >= from);
  const kwh = kwhBetween(all, from, now + 1);
  const prevKwh = kwhBetween(all, prevFrom, from);
  const powers = cur.map((d) => d.power);
  const peak = cur.reduce<EnergyData | null>((m, d) => (!m || d.power > m.power ? d : m), null);

  const hourly = hourlyProfile(cur);
  const hourlyMax = Math.max(...hourly);
  const peakHour = hourlyMax > 0 ? hourly.indexOf(hourlyMax) : null;

  const dayStart = startOfLocalDay(now);
  const todayKwh = kwhBetween(all, dayStart, now + 1);
  const yesterdayKwh = kwhBetween(all, dayStart - 86400_000, dayStart);

  const spanMs = cur.length > 1 ? cur[cur.length - 1].timestamp - cur[0].timestamp : 0;
  const days = Math.max(spanMs / 86400_000, 1 / 24);
  const dailyKwh = kwh / days;
  const standbyW = percentile(powers, 5);
  const climate = cur.filter(isValidClimate);
  const last = all.length ? all[all.length - 1] : null;

  return {
    kwh,
    prevKwh,
    cost: kwh * settings.price,
    prevCost: prevKwh * settings.price,
    co2: kwh * settings.co2Factor,
    avgPower: powers.length ? powers.reduce((a, b) => a + b, 0) / powers.length : 0,
    peakPower: peak?.power ?? 0,
    peakTime: peak?.timestamp ?? null,
    standbyW,
    standbyYearCost: ((standbyW * 24 * 365) / 1000) * settings.price,
    dailyKwh,
    monthProjectionKwh: dailyKwh * 30,
    monthProjectionCost: dailyKwh * 30 * settings.price,
    todayKwh,
    todayCost: todayKwh * settings.price,
    yesterdayKwh,
    hourly,
    peakHour,
    current: last,
    online: !!last && now - last.timestamp < 12 * 60_000,
    deltaKwhPct: prevKwh > 0.01 ? ((kwh - prevKwh) / prevKwh) * 100 : null,
    avgTemp: climate.length ? climate.reduce((a, d) => a + d.temperature, 0) / climate.length : null,
    avgHum: climate.filter(isValidHumidity).length ? climate.filter(isValidHumidity).reduce((a, d) => a + d.humidity, 0) / climate.filter(isValidHumidity).length : null,
  };
}

export const fmt = (n: number, digits = 1) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtEur = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

export function comfort(temp: number, hum: number): { label: string; tone: 'good' | 'warn' | 'bad' } {
  if (temp >= 20 && temp <= 25 && hum >= 40 && hum <= 60) return { label: 'Confort ideal', tone: 'good' };
  if (hum > 70) return { label: 'Ambiente muy húmedo', tone: 'bad' };
  if (hum < 30) return { label: 'Ambiente muy seco', tone: 'bad' };
  if (temp > 27) return { label: 'Demasiado calor', tone: 'bad' };
  if (temp < 17) return { label: 'Demasiado frío', tone: 'bad' };
  return { label: 'Aceptable', tone: 'warn' };
}

export interface Insight {
  icon: 'trend' | 'clock' | 'plug' | 'wallet' | 'leaf' | 'drop';
  tone: 'good' | 'warn' | 'info';
  title: string;
  text: string;
}

export function buildInsights(s: Summary, settings: Settings, periodLabel: string): Insight[] {
  const out: Insight[] = [];
  if (s.deltaKwhPct !== null) {
    const down = s.deltaKwhPct <= 0;
    out.push({
      icon: 'trend',
      tone: down ? 'good' : 'warn',
      title: down ? 'Estás consumiendo menos' : 'Tu consumo ha subido',
      text: `${Math.abs(s.deltaKwhPct).toFixed(0)}% ${down ? 'menos' : 'más'} que el periodo anterior (${periodLabel}). Diferencia: ${fmtEur(Math.abs(s.cost - s.prevCost))}.`,
    });
  }
  if (s.peakHour !== null) {
    out.push({
      icon: 'clock',
      tone: 'info',
      title: `Tu hora punta: ${String(s.peakHour).padStart(2, '0')}:00`,
      text: 'Es la franja con mayor potencia media. Si tienes tarifa por horas, mueve ahí tus consumos flexibles a valle.',
    });
  }
  if (s.standbyW > 5) {
    out.push({
      icon: 'plug',
      tone: 'warn',
      title: `Consumo base de ${fmt(s.standbyW, 0)} W`,
      text: `Es lo que gastas incluso "sin hacer nada". Al año supone unos ${fmtEur(s.standbyYearCost)}. Revisa equipos en standby.`,
    });
  }
  if (settings.monthlyBudget > 0 && s.monthProjectionCost > 0) {
    const over = s.monthProjectionCost > settings.monthlyBudget;
    out.push({
      icon: 'wallet',
      tone: over ? 'warn' : 'good',
      title: over ? 'Vas a pasarte de presupuesto' : 'Dentro de tu presupuesto',
      text: `A este ritmo gastarás ${fmtEur(s.monthProjectionCost)} este mes frente a un presupuesto de ${fmtEur(settings.monthlyBudget)}.`,
    });
  }
  if (s.avgHum !== null && s.avgHum > 65) {
    out.push({
      icon: 'drop',
      tone: 'warn',
      title: 'Humedad elevada',
      text: `Media de ${fmt(s.avgHum, 0)}% de humedad. Ventila o usa deshumidificador para evitar moho.`,
    });
  }
  if (s.co2 > 0) {
    out.push({
      icon: 'leaf',
      tone: 'info',
      title: `${fmt(s.co2, 2)} kg de CO₂`,
      text: `Emisiones estimadas del periodo con ${settings.co2Factor.toFixed(2)} kg/kWh. Un árbol absorbe unos 20 kg al año.`,
    });
  }
  return out;
}
