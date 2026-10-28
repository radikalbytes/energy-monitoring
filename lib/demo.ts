import { EnergyData } from '../types/energyData';

// Datos sintéticos para previsualizar el panel cuando aún no hay lecturas reales.
export function generateDemo(days = 62, now = Date.now(), uuid = 'demo-salon'): EnergyData[] {
  const step = 5 * 60_000;
  const out: EnergyData[] = [];
  let seed = 42;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let t = Math.floor((now - days * 86400_000) / step) * step; t <= now; t += step) {
    const d = new Date(t);
    const h = d.getHours() + d.getMinutes() / 60;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const base = 95 + rnd() * 20;
    const morning = 420 * Math.exp(-Math.pow(h - 8, 2) / 1.5);
    const evening = (weekend ? 900 : 780) * Math.exp(-Math.pow(h - 21, 2) / 4);
    const lunch = (weekend ? 520 : 150) * Math.exp(-Math.pow(h - 14, 2) / 2);
    const spike = rnd() > 0.985 ? 800 + rnd() * 700 : 0;
    const power = Math.max(60, base + morning + evening + lunch + spike + (rnd() - 0.5) * 60);
    const temperature = 21.5 + 2.5 * Math.sin(((h - 15) / 24) * 2 * Math.PI) + (rnd() - 0.5) * 0.4;
    const humidity = 52 - 6 * Math.sin(((h - 15) / 24) * 2 * Math.PI) + (rnd() - 0.5) * 2;
    out.push({
      uuid,
      timestamp: t,
      power: Math.round(power * 10) / 10,
      irms: Math.round((power / 230) * 100) / 100,
      temperature: Math.round(temperature * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
    });
  }
  return out;
}
