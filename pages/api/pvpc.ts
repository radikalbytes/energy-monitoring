import type { NextApiRequest, NextApiResponse } from 'next';
import type { PvpcPoint } from '../../lib/tariffs';

const madridDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d); // YYYY-MM-DD

// Precio PVPC horario publicado por Red Eléctrica (datos abiertos, sin token). Valores en €/MWh.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const today = madridDate(new Date());
    const end = madridDate(new Date(Date.now() + 36 * 3600_000));
    const url =
      `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real` +
      `?start_date=${today}T00:00&end_date=${end}T23:59&time_trunc=hour`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`REE respondió ${r.status}`);
    const j = await r.json();
    const pvpc = (j.included ?? []).find((s: { type: string }) => s.type === 'PVPC');
    const values: { value: number; datetime: string }[] = pvpc?.attributes?.values ?? [];
    const points: PvpcPoint[] = values
      .map((v) => ({ ts: new Date(v.datetime).getTime(), price: v.value / 1000 }))
      .filter((p) => Number.isFinite(p.ts) && Number.isFinite(p.price));
    if (!points.length) throw new Error('REE no devolvió precios PVPC');
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({ points, source: 'Red Eléctrica de España (apidatos.ree.es)', updated: pvpc.attributes['last-update'] ?? null });
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : 'No se pudo obtener el PVPC' });
  }
}
