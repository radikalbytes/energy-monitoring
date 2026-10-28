export interface PvpcPoint {
  ts: number; // inicio de la hora (ms)
  price: number; // €/kWh
}

export type HourBand = 'gold' | 'economic' | 'normal' | 'forbidden';

export interface Comercializadora {
  id: string;
  name: string;
  // Las comercializadoras de referencia ofrecen PVPC (precio regulado, variable por horas) y el bono social.
  pvpc: boolean;
  web: string;
}

export const COMERCIALIZADORAS: Comercializadora[] = [
  { id: 'pvpc', name: 'PVPC genérico (precio regulado)', pvpc: true, web: 'https://www.esios.ree.es' },
  { id: 'curenergia', name: 'Curenergía (Iberdrola) · PVPC', pvpc: true, web: 'https://www.curenergia.es' },
  { id: 'energia-xxi', name: 'Energía XXI (Endesa) · PVPC', pvpc: true, web: 'https://www.energiaxxi.com' },
  { id: 'naturgy-regulada', name: 'Comercializadora Regulada (Naturgy) · PVPC', pvpc: true, web: 'https://www.comercializadoraregulada.es' },
  { id: 'edp-cur', name: 'EDP Comercializadora de Último Recurso · PVPC', pvpc: true, web: 'https://www.edpenergia.es' },
  { id: 'iberdrola', name: 'Iberdrola · mercado libre', pvpc: false, web: 'https://www.iberdrola.es' },
  { id: 'endesa', name: 'Endesa · mercado libre', pvpc: false, web: 'https://www.endesa.com' },
  { id: 'naturgy', name: 'Naturgy · mercado libre', pvpc: false, web: 'https://www.naturgy.es' },
  { id: 'repsol', name: 'Repsol · mercado libre', pvpc: false, web: 'https://www.repsol.es' },
  { id: 'totalenergies', name: 'TotalEnergies · mercado libre', pvpc: false, web: 'https://totalenergies.es' },
  { id: 'octopus', name: 'Octopus Energy · mercado libre', pvpc: false, web: 'https://octopusenergy.es' },
  { id: 'holaluz', name: 'Holaluz · mercado libre', pvpc: false, web: 'https://www.holaluz.com' },
  { id: 'otra', name: 'Otra comercializadora · precio fijo', pvpc: false, web: '' },
];

export type DiscountKey = 'none' | 'vulnerable' | 'severe' | 'exclusion';

export const DISCOUNT_LABELS: Record<DiscountKey, string> = {
  none: 'Sin descuento',
  vulnerable: 'Consumidor vulnerable',
  severe: 'Vulnerable severo',
  exclusion: 'Riesgo de exclusión social',
};

// Porcentajes vigentes del bono social; son editables por si cambian.
export const DEFAULT_DISCOUNT_RATES: Record<Exclude<DiscountKey, 'none'>, number> = {
  vulnerable: 42.5,
  severe: 57.5,
  exclusion: 100,
};

export type HouseholdKey = 'h1' | 'h3' | 'h4' | 'h5';

export const HOUSEHOLD_LABELS: Record<HouseholdKey, string> = {
  h1: '1 o 2 personas',
  h3: '3 personas (o pensionistas / 1 menor)',
  h4: '4 personas (o 2 menores)',
  h5: '5 o más personas / familia numerosa',
};

export const DEFAULT_HOUSEHOLD_LIMITS: Record<HouseholdKey, number> = {
  h1: 1587,
  h3: 2222,
  h4: 2698,
  h5: 4761,
};

export const BAND_COLORS: Record<HourBand, string> = {
  gold: '#10b981',
  economic: '#facc15',
  normal: '#94a3b8',
  forbidden: '#ef4444',
};

export const BAND_LABELS: Record<HourBand, string> = {
  gold: 'Hora de oro',
  economic: 'Ventana económica',
  normal: 'Normal',
  forbidden: 'Hora prohibida',
};

// Verde: la hora más barata. Amarillo: horas baratas (hasta el 35 % del rango de precios).
// Rojo: las 4 horas más caras (y siempre por encima de la media).
export function classifyDay(points: PvpcPoint[]): HourBand[] {
  if (!points.length) return [];
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const range = max - min;
  const goldIdx = prices.indexOf(min);
  const order = prices.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]);
  const forbidden = new Set(order.slice(0, 4).filter(([p]) => p > avg && range > 0).map(([, i]) => i));
  return prices.map((p, i) => {
    if (i === goldIdx) return 'gold';
    if (forbidden.has(i)) return 'forbidden';
    if (range > 0 && p <= min + range * 0.35) return 'economic';
    return 'normal';
  });
}

export interface AnnualStatus {
  limit: number;
  used: number;
  pct: number;
  remaining: number;
  exceeded: boolean;
  projectedYear: number | null;
  projectedExceedDate: number | null;
}

export function annualStatus(usedKwh: number, limit: number, periodStart: number, now: number): AnnualStatus {
  const elapsedDays = Math.max((now - periodStart) / 86400_000, 1);
  const dailyKwh = usedKwh / elapsedDays;
  const projectedYear = dailyKwh * 365;
  const remaining = Math.max(limit - usedKwh, 0);
  const exceeded = usedKwh >= limit;
  const projectedExceedDate =
    !exceeded && dailyKwh > 0 && projectedYear > limit ? now + (remaining / dailyKwh) * 86400_000 : null;
  return { limit, used: usedKwh, pct: limit > 0 ? (usedKwh / limit) * 100 : 0, remaining, exceeded, projectedYear, projectedExceedDate };
}
